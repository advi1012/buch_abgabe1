/* eslint-disable @typescript-eslint/interface-name-prefix */
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

import { Buch } from '../model/buch'
import { BuchService } from '../service/buch.service'
import { IResolverObject } from 'graphql-tools/dist/Interfaces'

const buchService = new BuchService()

const findBuecher = (titel: string) => {
    if (titel === undefined) {
        // Kein Titel: alle Buecher suchen
        return buchService.find({})
    }
    return buchService.find({ titel })
}

// Queries passend zu "type Query" in typeDefs.ts
const query: IResolverObject = {
    // Buecher suchen, ggf. mit Titel als Suchkriterium
    buecher: (_: unknown, { titel }: any) => findBuecher(titel),
    // Ein Buch mit einer bestimmten ID suchen
    buch: (_: unknown, { id }: any) => buchService.findById(id),
}

interface IBuch {
    _id?: string
    titel: string
    rating?: number
    art?: string
    verlag: string
    preis: number
    rabatt?: number
    lieferbar?: boolean
    datum?: string | Date
    isbn: string
    homepage?: string
    schlagwoerter?: Array<string>
    version: number
}

const createBuch = (buch: IBuch) => {
    buch.datum = new Date(buch.datum as string)
    const buchDocument = new Buch(buch)
    return buchService.create(buchDocument)
}

const updateBuch = (buch: IBuch) => {
    buch.datum = new Date(buch.datum as string)
    const buchDocument = new Buch(buch)
    buchService.update(buchDocument, buch.version.toString())
}

const deleteBuch = async (id: string) => {
    await buchService.remove(id)
}

const mutation: IResolverObject = {
    createBuch: (_: unknown, buch: IBuch) => createBuch(buch),
    updateBuch: (_: unknown, buch: IBuch) => updateBuch(buch),
    deleteBuch: (_: unknown, { id }: any) => deleteBuch(id),
}

export const resolvers = {
    Query: query,
    Mutation: mutation,
}
