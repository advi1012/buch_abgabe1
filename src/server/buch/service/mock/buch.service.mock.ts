/* eslint-disable @typescript-eslint/no-unused-vars */
/*
 * Copyright (C) 2018 - present Juergen Zimmermann, Hochschule Karlsruhe
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
import { buch, buecher } from './buch'
import { BuchDocument } from '../../model/buch'
import { Document } from 'mongoose'
import { logger } from '../../../shared'

/* eslint-disable require-await */
export class BuchServiceMock {
    async findById(id: string) {
        buch._id = id
        return this.toBuchDocument(buch)
    }

    async find(_?: any) {
        return buecher.map(b => this.toBuchDocument(b))
    }

    async create(doc: Document) {
        doc._id = uuid()
        logger.info(`Neues Buch: ${JSON.stringify(doc)}`)
        return doc
    }

    async update(doc: Document) {
        if (doc.__v !== undefined) {
            doc.__v++
        }
        logger.info(`Aktualisiertes Buch: ${JSON.stringify(doc)}`)
        return Promise.resolve(doc)
    }

    async remove(id: string) {
        logger.info(`ID des geloeschten Buches: ${id}`)
    }

    private toBuchDocument = (buchJSON: any): BuchDocument =>
        new Promise((resolve, _) => resolve(buchJSON)) as any // eslint-disable-line
}
