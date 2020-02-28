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

// http://json-schema.org
// http://json-schema.org/implementations.html#validator-javascript
// http://epoberezkin.github.io/ajvs
import * as Ajv from 'ajv'
import { log, logger } from '../../shared'
import { join } from 'path'
// https://nodejs.org/api/fs.html
// https://github.com/nodejs/node/blob/master/lib/buffer.js#L191
// Einzulesende oder zu schreibende Dateien im Format UTF-8
import { readFileSync } from 'fs'

export class UsersService {
    private users = JSON.parse(
        readFileSync(join(__dirname, 'json', 'users.json'), 'utf-8'),
    )

    constructor() {
        const ajv = new Ajv({ allErrors: true, verbose: true })
        const schema = JSON.parse(
            readFileSync(join(__dirname, 'json', 'users.schema.json'), 'utf-8'),
        )
        const valid = ajv.validate(schema, this.users)
        if (!valid) {
            logger.error(`${JSON.stringify(ajv.errors)}`)
        }
        logger.info(
            `Die Benutzerkennungen sind eingelesen: ${JSON.stringify(
                this.users,
            )}`,
        )
    }

    @log
    findByUsername(username: string) {
        return this.users.find((u: any) => u.username === username)
    }

    @log
    findById(id: string) {
        return this.users.find((u: any) => u._id === id)
    }

    @log
    findByEmail(email: string) {
        return this.users.find((u: any) => u.email === email)
    }

    toString() {
        return 'UsersService'
    }
}
