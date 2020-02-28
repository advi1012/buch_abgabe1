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

import { readFileSync } from 'fs'
import { resolve } from 'path'

const { AS_HOST, AS_PORT } = process.env
const host = AS_HOST === undefined ? 'localhost' : AS_HOST
// const host = AS_HOST !== undefined ? AS_HOST : '127.0.0.1'

const portStr = AS_PORT === undefined ? '8443' : AS_PORT
const port = parseInt(portStr, 10)

export const SERVER_CONFIG = {
    host,
    port,

    // https://nodejs.org/api/https.html
    // https://nodejs.org/api/fs.html
    // https://nodejs.org/api/path.html
    // http://2ality.com/2017/11/import-meta.html
    key: readFileSync(resolve(__dirname, 'key.pem')),
    cert: readFileSync(resolve(__dirname, 'certificate.cer')),
}
