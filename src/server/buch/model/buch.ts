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

import { Document, Schema, model } from 'mongoose'
import { MAX_RATING, audit, autoIndex, optimistic } from '../../shared'
import { isISBN, isURL, isUUID } from 'validator'

// Eine Collection in MongoDB besteht aus Dokumenten im BSON-Format

// zur Pflege der Zeitstempel in der Funktion "audit" in db.ts
export interface BuchDocument extends Document {
    erzeugt: number
    aktualisiert: number
}

// Mongoose ist von Valeri Karpov, der auch den Begriff "MEAN-Stack" gepraegt hat:
// http://thecodebarbarian.com/2013/04/29//easy-web-prototyping-with-mongodb-and-nodejs
// Ein Schema in Mongoose definiert die Struktur und Methoden fuer die
// Dokumente in einer Collection.
// Ein Property im Schema definiert eine Property fuer jedes Dokument.
// Ein Schematyp (String, Number, Boolean, Date, Array, ObjectId) legt den Typ
// der Property fest.
// Objection.js ist ein alternatives Werkzeug für ORM:
// http://vincit.github.io/objection.js
export const schema = new Schema({
    // MongoDB erstellt implizit einen Index fuer _id
    _id: { type: String },
    titel: { type: String, required: true, unique: true },
    rating: Number,
    art: String,
    verlag: { type: String, required: true },
    preis: { type: Number, required: true },
    rabatt: Number,
    lieferbar: Boolean,
    datum: Date,
    isbn: { type: String, required: true, unique: true },
    homepage: String,
    schlagwoerter: { type: [String], index: true },
    autoren: [Schema.Types.Mixed],
})

// Optimistische Synchronisation durch das Feld __v fuer die Versionsnummer
schema.plugin(optimistic)
// Auditing durch die Felder "erzeugt" und aktualisiert
schema.plugin(audit)

// fuer ein Document (-Objekt) die Methode toJSON bereitstellen
schema.set('toJSON', { getters: true, virtuals: false })

// automat. Validierung der Indexe beim 1. Zugriff
schema.set('autoIndex', autoIndex)

// Methoden zum Schema hinzufuegen, damit sie spaeter beim Model (s.u.)
// verfuegbar sind, was aber bei buch.check() zu eines TS-Syntaxfehler fuehrt:
// schema.methods.check = () => {...}
// schema.statics.findByTitel =
//     (titel: string, cb: Function) =>
//         return this.find({titel: titel}, cb)

// Ein Model ist ein uebersetztes Schema und stellt die CRUD-Operationen fuer
// die Dokumente bereit, d.h. das Pattern "Active Record" wird realisiert.
// Name des Models = Name der Collection
export const Buch = model<BuchDocument>('Buch', schema)

const isPresent = (obj: string | undefined) => obj !== undefined && obj !== null
const isEmpty = (obj: string | undefined) =>
    obj === undefined || obj === null || obj === ''

export const validateBuch = (buch: any) => {
    const err: any = {}
    const { titel, art, rating, verlag, isbn, homepage } = buch

    if (!buch.isNew && !isUUID(buch._id)) {
        err.id = 'Das Buch hat eine ungueltige ID.'
    }
    if (isEmpty(titel)) {
        err.titel = 'Ein Buch muss einen Titel haben.'
    } else if (!titel.match(/^\w.*/)) {
        err.titel =
            'Ein Buchtitel muss mit einem Buchstaben, einer Ziffer oder _ beginnen.'
    }
    if (isEmpty(art)) {
        err.art = 'Die Art eines Buches muss gesetzt sein'
    } else if (art !== 'KINDLE' && buch.art !== 'DRUCKAUSGABE') {
        err.art = 'Die Art eines Buches muss KINDLE oder DRUCKAUSGABE sein.'
    }
    if (isPresent(rating) && (rating < 0 || rating > MAX_RATING)) {
        err.rating = `${rating} ist keine gueltige Bewertung.`
    }
    if (isEmpty(verlag)) {
        err.verlag = 'Der Verlag des Buches muss gesetzt sein.'
    } else if (verlag !== 'IWI_VERLAG' && verlag !== 'HSKA_VERLAG') {
        err.verlag =
            'Der Verlag eines Buches muss IWI_VERLAG oder HSKA_VERLAG sein.'
    }
    if (isPresent(isbn) && !isISBN(isbn)) {
        err.isbn = `${isbn} ist keine gueltige ISBN-Nummer.`
    }
    // Falls "preis" ein string ist: Pruefung z.B. 12.30
    // if (isPresent(preis) && !isCurrency(`${preis}`)) {
    //     err.preis = `${preis} ist kein gueltiger Preis`
    // }
    if (isPresent(homepage) && !isURL(homepage)) {
        err.homepage = `${homepage} ist keine gueltige URL.`
    }

    return Object.keys(err).length === 0 ? undefined : err
}
