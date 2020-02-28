/*
 * Copyright (C) 2016 - present Juergen Zimmermann, Hochschule Karlsruhe
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import * as mongoose from 'mongoose'
import { HttpStatus, MIME_CONFIG, getBaseUri, log, logger } from '../../shared'
import {
    IsbnExistsError,
    TitelExistsError,
    ValidationError,
    VersionInvalidError,
} from '../service/exceptions'
import { Request, Response } from 'express'
import { Buch } from '../model/buch'
import { BuchMultimediaService } from '../service/buch-multimedia.service'
import { BuchService } from '../service/buch.service'
import stringify from 'fast-safe-stringify'
import { unlink } from 'fs'

// export bei async und await:
// https://blogs.msdn.microsoft.com/typescript/2015/11/30/announcing-typescript-1-7
// http://tc39.github.io/ecmascript-export
// https://nemethgergely.com/async-function-best-practices#Using-async-functions-with-express

export class BuchRequestHandler {
    private readonly buchService = new BuchService()
    private readonly buchMultimediaService = new BuchMultimediaService()

    @log
    async findById(req: Request, res: Response) {
        const versionHeader = req.header('If-None-Match')
        const { id }: { id: string } = req.params
        logger.debug(`BuchRequestHandler.findById id = ${id}`)

        let buch: mongoose.Document | null = null
        try {
            buch = await this.buchService.findById(id)
        } catch (err) {
            // Exception einer export async function bei der Ausfuehrung fangen:
            // https://strongloop.com/strongblog/comparing-node-js-promises-trycatch-zone-js-angular
            logger.error(`BuchRequestHandler.findById Error: ${stringify(err)}`)
            res.sendStatus(HttpStatus.INTERNAL_ERROR)
            return
        }

        if (buch === null) {
            logger.debug('BuchRequestHandler.findById status = NOT_FOUND')
            res.sendStatus(HttpStatus.NOT_FOUND)
            return
        }

        logger.debug(
            `BuchRequestHandler.findById (): buch = ${JSON.stringify(buch)}`,
        )
        const versionDb = buch.__v
        if (versionHeader === `${versionDb}`) {
            res.sendStatus(HttpStatus.NOT_MODIFIED)
            return
        }
        logger.debug(`BuchRequestHandler.findById VersionDb = ${versionDb}`)
        res.header('ETag', `"${versionDb}"`)

        const baseUri = getBaseUri(req)
        const payload = this.toJsonPayload(buch)
        // HATEOAS: Atom Links
        payload.links = [
            { rel: 'self', href: `${baseUri}/${id}` },
            { rel: 'list', href: `${baseUri}` },
            { rel: 'add', href: `${baseUri}` },
            { rel: 'update', href: `${baseUri}/${id}` },
            { rel: 'remove', href: `${baseUri}/${id}` },
        ]
        res.json(payload)
    }

    @log
    async find(req: Request, res: Response) {
        // z.B. https://.../buch?titel=Alpha
        const { query } = req
        logger.debug(
            `BuchRequestHandler.find queryParams = ${JSON.stringify(query)}`,
        )

        let buecher: Array<mongoose.Document> = []
        try {
            buecher = await this.buchService.find(query)
        } catch (err) {
            logger.error(`BuchRequestHandler.find Error: ${stringify(err)}`)
            res.sendStatus(HttpStatus.INTERNAL_ERROR)
        }

        logger.debug(
            `BuchRequestHandler.find: buecher = ${JSON.stringify(buecher)}`,
        )
        if (buecher.length === 0) {
            // Alternative: https://www.npmjs.com/package/http-errors
            // Damit wird aber auch der Stacktrace zum Client
            // uebertragen, weil das resultierende Fehlerobjekt
            // von Error abgeleitet ist.
            logger.debug('status = NOT_FOUND')
            res.sendStatus(HttpStatus.NOT_FOUND)
            return
        }

        const baseUri = getBaseUri(req)

        // asynchrone for-of Schleife statt synchrones buecher.map()
        const payload = []
        for await (const buch of buecher) {
            const buchResource = this.toJsonPayload(buch)
            // HATEOAS: Atom Links je Buch
            /* eslint-disable array-bracket-newline */
            buchResource.links = [
                { rel: 'self', href: `${baseUri}/${buch._id}` },
            ]
            /* eslint-enable array-bracket-newline */
            payload.push(buchResource)
        }

        res.json(payload)
    }

    @log
    async create(req: Request, res: Response) {
        const contentType = req.header(MIME_CONFIG.contentType)
        if (
            contentType === undefined ||
            contentType.toLowerCase() !== MIME_CONFIG.json
        ) {
            logger.debug('BuchRequestHandler.create status = NOT_ACCEPTABLE')
            res.sendStatus(HttpStatus.NOT_ACCEPTABLE)
            return
        }

        const buch = new Buch(req.body)
        logger.debug(`BuchRequestHandler.create body: ${JSON.stringify(buch)}`)

        let buchSaved: mongoose.Document | undefined = undefined
        try {
            buchSaved = await this.buchService.create(buch)
        } catch (err) {
            if (err instanceof ValidationError) {
                res.status(HttpStatus.BAD_REQUEST).send(JSON.parse(err.message))
                return
            }
            if (err instanceof TitelExistsError) {
                res.status(HttpStatus.BAD_REQUEST).send(err.message)
                return
            }
            if (err instanceof IsbnExistsError) {
                res.status(HttpStatus.BAD_REQUEST).send(err.message)
                return
            }

            logger.error(`Error: ${stringify(err)}`)
            res.sendStatus(HttpStatus.INTERNAL_ERROR)
            return
        }

        const location = `${getBaseUri(req)}/${buchSaved._id}`
        logger.debug(`BuchRequestHandler.create: location = ${location}`)
        res.location(location)
        res.sendStatus(HttpStatus.CREATED)
    }

    @log
    async update(req: Request, res: Response) {
        const { id }: { id: string } = req.params
        logger.debug(`BuchRequestHandler.update id = ${id}`)

        const contentType = req.header(MIME_CONFIG.contentType)
        if (
            contentType === undefined ||
            contentType.toLowerCase() !== MIME_CONFIG.json
        ) {
            res.status(HttpStatus.NOT_ACCEPTABLE)
            return
        }
        const versionHeader = req.header('If-Match')
        logger.debug(
            `BuchRequestHandler.update versionHeader: ${versionHeader}`,
        )

        const buch = new Buch(req.body)
        buch._id = id
        logger.debug(`BuchRequestHandler.update buch: ${JSON.stringify(buch)}`)

        let result: mongoose.Document | undefined = undefined
        try {
            result = await this.buchService.update(buch, versionHeader)
        } catch (err) {
            logger.debug(`BuchRequestHandler.update Error: ${stringify(err)}`)
            if (err instanceof VersionInvalidError) {
                logger.debug(
                    `BuchRequestHandler.update status = 412, message: ${
                        err.message
                    }`,
                )
                res.status(HttpStatus.PRECONDITION_FAILED).send(err.message)
                return
            }
            if (err instanceof ValidationError) {
                res.status(HttpStatus.BAD_REQUEST).send(JSON.parse(err.message))
                return
            }
            if (err instanceof TitelExistsError) {
                res.status(HttpStatus.BAD_REQUEST).send(err.message)
                return
            }

            logger.error(`BuchRequestHandler.update Error: ${stringify(err)}`)
            res.sendStatus(HttpStatus.INTERNAL_ERROR)
            return
        }

        logger.debug(`BuchRequestHandler.update result: ${result}`)
        res.sendStatus(HttpStatus.NO_CONTENT)
    }

    @log
    async delete(req: Request, res: Response) {
        const { id }: { id: string } = req.params
        logger.debug(`BuchRequestHandler.delete id = ${id}`)

        try {
            await this.buchService.remove(id)
        } catch (err) {
            logger.error(`BuchRequestHandler.delete Error: ${stringify(err)}`)
            res.sendStatus(HttpStatus.INTERNAL_ERROR)
            return
        }

        res.sendStatus(HttpStatus.NO_CONTENT)
    }

    @log
    async upload(req: Request, res: Response) {
        const { id }: { id: string } = req.params

        // Multer ergaenzt das Request-Objekt um die Property "file".
        // Das file-Objekt wiederum enthaelt die Properties path, size, mimetype.
        if (Object.keys(req).includes('file') === false) {
            const msg = 'Keine Property "file" im Request-Objekt'
            logger.error(`BuchRequestHandler.upload: ${msg}`)
            res.status(HttpStatus.INTERNAL_ERROR).send(msg)
            return
        }

        const { file } = req as any
        const { path, mimetype } = file
        let result: boolean | undefined = undefined
        try {
            result = await this.buchMultimediaService.save(id, path, mimetype)
        } catch (err) {
            logger.error(`BuchRequestHandler.upload Error: ${stringify(err)}`)
            res.sendStatus(HttpStatus.INTERNAL_ERROR)
            return
        }

        if (result === false) {
            res.sendStatus(HttpStatus.NOT_FOUND)
        }

        res.sendStatus(HttpStatus.NO_CONTENT)
    }

    @log
    download(req: Request, res: Response) {
        const { id }: { id: string } = req.params
        const cbSendFile = (pathname: string) => {
            logger.debug(
                `BuchRequestHandler.download cbSendFile(): ${pathname}`,
            )
            const unlinkCb = (err: any) => {
                if (err) {
                    logger.error(
                        `BuchRequestHandler.download cbSendFile Error: ${stringify(
                            err,
                        )}`,
                    )
                    throw err
                }
                logger.debug(
                    `BuchRequestHandler.download Geloescht: ${pathname}`,
                )
            }
            res.sendFile(pathname, (__: unknown) => unlink(pathname, unlinkCb)) // eslint-disable-line
        }
        const cbSendErr = (statuscode: number) => res.sendStatus(statuscode)

        try {
            this.buchMultimediaService.findMedia(id, cbSendFile, cbSendErr)
        } catch (err) {
            logger.error(`BuchRequestHandler.download Error: ${stringify(err)}`)
            res.sendStatus(HttpStatus.INTERNAL_ERROR)
        }
    }

    toString() {
        return 'BuchRequestHandler'
    }

    private toJsonPayload(buch: mongoose.Document): any {
        const {
            titel,
            rating,
            art,
            verlag,
            preis,
            rabatt,
            lieferbar,
            datum,
            isbn,
            schlagwoerter,
            autoren,
        } = buch as any
        return {
            titel,
            rating,
            art,
            verlag,
            preis,
            rabatt,
            lieferbar,
            datum,
            isbn,
            schlagwoerter,
            autoren,
        }
    }
}
