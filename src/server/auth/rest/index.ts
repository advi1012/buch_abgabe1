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

import { NextFunction, Request, Response } from 'express'
import { AuthRequestHandler } from './auth.request-handler'

const handler = new AuthRequestHandler()

export const login = (req: Request, res: Response) => handler.login(req, res)

export const validateJwt = (req: Request, res: Response, next: NextFunction) =>
    handler.validateJwt(req, res, next)

export const isLoggedIn = (req: Request, res: Response, next: NextFunction) =>
    handler.isLoggedIn(req, res, next)

export const isAdmin = (req: Request, res: Response, next: NextFunction) =>
    handler.isAdmin(req, res, next)

export const isMitarbeiter = (
    req: Request,
    res: Response,
    next: NextFunction,
) => handler.isMitarbeiter(req, res, next)

export const isAdminMitarbeiter = (
    req: Request,
    res: Response,
    next: NextFunction,
) => handler.isAdminMitarbeiter(req, res, next)
