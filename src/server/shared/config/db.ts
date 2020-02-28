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
import { BuchDocument } from '../../buch/model/buch'
import { logger } from '../logger'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import stringify from 'fast-safe-stringify'

export const mockDB = process.env.DB_MOCK === 'true'

// http://mongoosejs.com/docs/connections.html
// https://github.com/mongodb/node-mongodb-native
// https://docs.mongodb.com/manual/tutorial/configure-ssl-clients
// Defaultwerte
//      Port        27017
//      Poolsize    5

const { DB_HOST, DB_PORT } = process.env
const host = DB_HOST === undefined ? 'localhost' : DB_HOST
// const host = DB_HOST !== undefined ? DB_HOST : '127.0.0.1'

const portStr = DB_PORT === undefined ? '27017' : DB_PORT
const port = parseInt(portStr, 10)

const url = `mongodb://${host}:${port}`
const dbName = 'hska'
const user = 'admin'
const pass = 'p'
const authSource = 'admin'
const replicaSet = 'replicaSet'
const ssl = true
const sslCert = readFileSync(resolve(__dirname, 'mongodb.cer'))
// auch noch bei Mongoose 5.x
const useNewUrlParser = true

// Name eines mongoose-Models = Name der Collection
mongoose.pluralize(undefined)

// Anpassungen fuer MongoDB 4
// https://github.com/Automattic/mongoose/issues/6880
// https://github.com/Automattic/mongoose/issues/6922
mongoose.set('useFindAndModify', false)
mongoose.set('useCreateIndex', true)

// Callback: Start des Appservers, nachdem der DB-Server gestartet ist

export const connectDB = async () => {
    if (mockDB) {
        console.warn('Mocking: Keine DB-Verbindung')
        return
    }

    const { connection } = mongoose
    // http://mongoosejs.com/docs/api.html#index_Mongoose-createConnection
    // http://mongoosejs.com/docs/api.html#connection_Connection-open
    // http://mongoosejs.com/docs/connections.html
    // https://github.com/Automattic/mongoose/issues/5304
    // https://docs.mongodb.com/manual/reference/connection-string/#connections-connection-options
    // http://mongodb.github.io/node-mongodb-native/2.1/api/MongoClient.html
    try {
        await mongoose.connect(
            url,
            // http://mongoosejs.com/docs/connections.html
            // http://mongodb.github.io/node-mongodb-native/3.1/api/MongoClient.html#.connect
            {
                user,
                pass,
                authSource,
                dbName,
                replicaSet,
                ssl,
                sslCert,
                useNewUrlParser,
            },
        )
    } catch (err) {
        logger.error(`${stringify(err)}`)
        logger.error(`FEHLER beim Aufbau der DB-Verbindung: ${err.message}\n`)
        process.exit(0)
    }
    logger.info(`DB-Verbindung zu ${connection.db.databaseName} ist aufgebaut`)

    connection.on('disconnecting', () =>
        logger.warn('DB-Verbindung wird geschlossen...'),
    )
    connection.on('disconnected', () =>
        logger.warn('DB-Verbindung ist geschlossen.'),
    )
    connection.on('error', () => logger.error('Fehlerhafte DB-Verbindung'))
}

// In Produktion auf false setzen
export const autoIndex = true

const temp = 'temp'
export const uploadDir = resolve(__dirname, '..', '..', '..', temp, 'upload')
logger.debug(`Upload-Verzeichnis: ${uploadDir}`)
export const downloadDir = resolve(
    __dirname,
    '..',
    '..',
    '..',
    temp,
    'download',
)
logger.debug(`Download-Verzeichnis: ${downloadDir}`)

// https://github.com/prettier/prettier/issues/3847
/* eslint-disable space-before-function-paren */

export const optimistic = (schema: mongoose.Schema) => {
    // https://stackoverflow.com/questions/35288488/...
    // ...easy-way-to-increment-mongoose-document-versions-for-any-update-queries
    // http://mongoosejs.com/docs/middleware.html
    // findOneAndUpdate beinhaltet auch findByIdAndUpdate
    schema.pre('findOneAndUpdate', function(next) {
        // this referenziert das Query-Objekt
        this.update({}, { $inc: { __v: 1 } }, next)
        // TODO Warum wird __v um 2 erhoeht?

        next()
    })

    // schema.pre('save', function(next) {
    //     this.increment()
    //     next()
    // })
}

// https://medium.freecodecamp.org/introduction-to-mongoose-for-mongodb-d2a7aa593c57
export const audit = (schema: mongoose.Schema) => {
    // pre-save hook
    schema.pre<BuchDocument>('save', function(next: mongoose.HookNextFunction) {
        const now = Date.now()
        this.aktualisiert = now

        if (this.erzeugt === undefined) {
            this.erzeugt = now
        }
        next()
    })

    schema.pre('findOneAndUpdate', function(next: mongoose.HookNextFunction) {
        this.update({}, { aktualisiert: Date.now() }, next)
        next()
    })
}
