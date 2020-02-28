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

import * as uuid from 'uuid/v4'
import { Buch, validateBuch } from '../model/buch'
import {
    IsbnExistsError,
    TitelExistsError,
    ValidationError,
    VersionInvalidError,
} from './exceptions'
import { log, logger, sendMail } from '../../shared'
import { BuchServiceMock } from './mock/buch.service.mock'
import { Document } from 'mongoose'
import { mockDB } from '../../shared/config'

// FIXME mongoose.d.ts enthaelt noch nicht startSession, startTransaction, ...
declare module 'mongoose' {
    interface Model<T extends Document, QueryHelpers = {}>
        extends NodeJS.EventEmitter,
            ModelProperties {
        startSession(): any
    }
}

// API-Dokumentation zu mongoose:
// http://mongoosejs.com/docs/api.html
// https://github.com/Automattic/mongoose/issues/3949

/* eslint-disable require-await */
export class BuchService {
    private readonly mock: BuchServiceMock | undefined

    constructor() {
        if (mockDB) {
            this.mock = new BuchServiceMock()
        }
    }

    // Status eines Promise:
    // Pending: das Resultat gibt es noch nicht, weil die asynchrone Operation,
    //          die das Resultat liefert, noch nicht abgeschlossen ist
    // Fulfilled: die asynchrone Operation ist abgeschlossen und
    //            das Promise-Objekt hat einen Wert
    // Rejected: die asynchrone Operation ist fehlgeschlagen and das
    //           Promise-Objekt wird nicht den Status "fulfilled" erreichen.
    //           Stattdessen ist im Promise-Objekt die Fehlerursache enthalten.

    @log
    async findById(id: string) {
        if (this.mock !== undefined) {
            return this.mock.findById(id)
        }
        // ein Buch zur gegebenen ID asynchron suchen
        // Pattern "Active Record" (urspruengl. von Ruby-on-Rails)
        // null falls nicht gefunden
        return Buch.findById(id)
    }

    @log
    async find(query?: any) {
        if (this.mock !== undefined) {
            return this.mock.find(query)
        }

        const tmpQuery = Buch.find()

        // alle Buecher asynchron suchen u. aufsteigend nach titel sortieren
        // nach _id sortieren: Timestamp des INSERTs (Basis: Sek)
        // https://docs.mongodb.org/manual/reference/object-id
        if (query === undefined || Object.keys(query).length === 0) {
            return tmpQuery.sort('titel')
        }

        const { titel, javascript, typescript, ...dbQuery } = query

        // Buecher zur Query (= JSON-Objekt durch Express) asynchron suchen
        if (titel !== undefined) {
            // Titel in der Query: Teilstring des Titels,
            // d.h. "LIKE" als regulaerer Ausdruck
            // 'i': keine Unterscheidung zw. Gross- u. Kleinschreibung
            dbQuery.titel = RegExp(titel, 'i')
        }

        // z.B. {javascript: true, typescript: true}
        if (javascript === 'true') {
            dbQuery.schlagwoerter = ['JAVASCRIPT']
        }
        if (typescript === 'true') {
            if (dbQuery.schlagwoerter === undefined) {
                dbQuery.schlagwoerter = ['TYPESCRIPT']
            } else {
                // OR statt AND
                // {$or: [{schlagwoerter: 'JAVASCRIPT'}, {schlagwoerter: 'TYPESCRIPT'}]}
                dbQuery.schlagwoerter.push('TYPESCRIPT')
            }
        }

        // Pattern "Active Record" (urspruengl. von Ruby-on-Rails)
        // leeres Array, falls nichts gefunden wird
        return Buch.find(dbQuery)
        // Buch.findOne(query), falls das Suchkriterium eindeutig ist
        // bei findOne(query) wird null zurueckgeliefert, falls nichts gefunden
    }

    @log
    async create(buch: Document) {
        if (this.mock !== undefined) {
            return this.mock.create(buch)
        }

        // Das gegebene Buch innerhalb von save() asynchron neu anlegen:
        // Promise.reject(err) bei Verletzung von DB-Constraints, z.B. unique

        const err = validateBuch(buch)
        if (err !== undefined) {
            const message = JSON.stringify(err)
            logger.debug(`Validation Message: ${message}`)
            // Promise<void> als Rueckgabewert
            // Eine von Error abgeleitete Klasse hat die Property "message"
            return Promise.reject(new ValidationError(message))
        }

        const session = await Buch.startSession()
        session.startTransaction()

        // Pattern "Active Record" (urspruengl. von Ruby-on-Rails)
        const { titel }: { titel: any } = buch as any
        let tmp = await Buch.findOne({ titel })
        if (tmp !== null) {
            // Promise<void> als Rueckgabewert
            // Eine von Error abgeleitete Klasse hat die Property "message"
            return Promise.reject(
                new TitelExistsError(`Der Titel "${titel}" existiert bereits.`),
            )
        }

        const { isbn }: { isbn: any } = buch as any
        tmp = await Buch.findOne({ isbn })
        if (tmp !== null) {
            return Promise.reject(
                new IsbnExistsError(
                    `Die ISBN-Nr. "${isbn}" existiert bereits.`,
                ),
            )
        }

        buch._id = uuid()
        const buchSaved = await buch.save()

        await session.commitTransaction()
        session.endSession()

        logger.debug(`Das Buch ist abgespeichert: ${JSON.stringify(buchSaved)}`)

        const to = 'joe@doe.mail'
        const subject = `Neues Buch ${buchSaved._id}`
        const body =
            `Das Buch mit dem Titel <strong>${(buchSaved as any).titel}` + // eslint-disable-line no-extra-parens
            '</strong> ist angelegt'
        logger.debug(`sendMail wird aufgerufen: ${to} / ${subject} / ${body}`)
        sendMail(to, subject, body)

        return buchSaved
    }

    @log
    async update(buch: Document, versionStr: string | undefined) {
        if (this.mock !== undefined) {
            return this.mock.update(buch)
        }

        if (versionStr === undefined) {
            return Promise.reject(
                new VersionInvalidError('Die Versionsnummer fehlt'),
            )
        }
        const version = Number.parseInt(versionStr, 10)
        if (Number.isNaN(version)) {
            return Promise.reject(
                new VersionInvalidError('Die Versionsnummer ist ungueltig'),
            )
        }

        const err = validateBuch(buch)
        if (err !== undefined) {
            const message = JSON.stringify(err)
            logger.debug(`Validation Message: ${message}`)
            // Promise<void> als Rueckgabewert
            return Promise.reject(new ValidationError(message))
        }

        const { titel }: { titel: any } = buch as any
        const tmp = await Buch.findOne({ titel })
        if (tmp !== null && tmp._id !== buch._id) {
            return Promise.reject(
                new TitelExistsError(
                    `Der Titel "${titel}" existiert bereits bei ${tmp._id}.`,
                ),
            )
        }

        const query = Buch.find().and([
            { _id: buch._id },
            { __v: { $gte: version } },
        ])

        // ggf. mit der Option {new: true}
        // findOneAndReplace ersetzt ein Document mit ggf. weniger Properties
        const result = await Buch.findOneAndUpdate(query, buch)
        if (result === null) {
            return Promise.reject(
                new VersionInvalidError(
                    `Kein Buch mit ID ${buch._id} und Version ${version}`,
                ),
            )
        }

        logger.debug(`BuchService.update(): result: ${JSON.stringify(result)}`)
        logger.debug(`BuchService.update(): version: ${result.__v}`)

        // Weitere Methoden von mongoose zum Aktualisieren:
        //    Buch.findByIdAndUpdate(update)
        //    buch.update(bedingung)
        return Promise.resolve(result)
    }

    @log
    async remove(id: string) {
        if (this.mock !== undefined) {
            return this.mock.remove(id)
        }

        // Das Buch zur gegebenen ID asynchron loeschen
        const buchPromise = Buch.findByIdAndRemove(id)
        // entspricht: findOneAndRemove({_id: id})

        // Ohne then (oder Callback) wird nicht geloescht,
        // sondern ein Query-Objekt zurueckgeliefert
        buchPromise.then(buch =>
            logger.debug(`Geloescht: ${JSON.stringify(buch)}`),
        )

        // Weitere Methoden von mongoose, um zu loeschen:
        //    Buch.findOneAndRemove(bedingung)
        //    Buch.remove(bedingung)
    }

    toString() {
        return 'BuchService'
    }
}
