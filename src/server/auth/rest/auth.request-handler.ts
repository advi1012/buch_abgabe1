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

import {
    AuthService,
    AuthorizationInvalidError,
    TokenExpiredError,
    TokenInvalidError,
} from '../service'
import { HttpStatus, log, logger } from '../../shared'
import { NextFunction, Request, Response } from 'express'

export class AuthRequestHandler {
    private readonly authService = new AuthService()

    @log
    async login(req: Request, res: Response) {
        const loginResult = await this.authService.login(req)
        if (loginResult === undefined) {
            logger.debug('401')
            res.sendStatus(HttpStatus.UNAUTHORIZED)
            return
        }
        res.json(loginResult).status(HttpStatus.OK)
    }

    @log
    validateJwt(req: Request, res: Response, next: NextFunction) {
        try {
            this.authService.validateJwt(req)
        } catch (err) {
            if (
                err instanceof TokenInvalidError ||
                err instanceof AuthorizationInvalidError
            ) {
                logger.debug(`401: ${err.name}, ${err.message}`)
                res.sendStatus(HttpStatus.UNAUTHORIZED)
                return
            }
            if (err instanceof TokenExpiredError) {
                logger.debug('401')
                res.header(
                    'WWW-Authenticate',
                    'Bearer realm="hska.de", error="invalid_token", error_description="The access token expired"',
                )
                res.status(HttpStatus.UNAUTHORIZED).send(
                    'The access token expired',
                )
                return
            }
            res.sendStatus(HttpStatus.INTERNAL_ERROR)
            return
        }

        next()
    }

    @log
    isLoggedIn(req: Request, res: Response, next: NextFunction) {
        if (!this.authService.isLoggedIn(req)) {
            logger.debug('401')
            res.sendStatus(HttpStatus.UNAUTHORIZED)
            return
        }

        // Verarbeitung fortsetzen
        next()
    }

    @log
    isAdmin(req: Request, res: Response, next: NextFunction) {
        if (!this.hasRolle(req, res, 'admin')) {
            return
        }

        // Verarbeitung fortsetzen
        next()
    }

    @log
    isMitarbeiter(req: Request, res: Response, next: NextFunction) {
        if (!this.hasRolle(req, res, 'mitarbeiter')) {
            return
        }

        // Verarbeitung fortsetzen
        next()
    }

    @log
    isAdminMitarbeiter(req: Request, res: Response, next: NextFunction) {
        if (!this.hasRolle(req, res, 'admin', 'mitarbeiter')) {
            return
        }

        // Verarbeitung fortsetzen
        next()
    }

    toString() {
        return 'AuthRequestHandler'
    }

    // Spread-Parameter
    @log
    private hasRolle(req: Request, res: Response, ...roles: Array<string>) {
        logger.debug(`Rollen = ${JSON.stringify(roles)}`)

        if (!this.authService.isLoggedIn(req)) {
            logger.debug('401')
            res.sendStatus(HttpStatus.UNAUTHORIZED)
            return false
        }

        if (!this.authService.hasAnyRole(req, roles)) {
            logger.debug('403')
            res.sendStatus(HttpStatus.FORBIDDEN)
            return false
        }

        return true
    }
}
