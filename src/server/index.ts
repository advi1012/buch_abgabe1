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

// https://github.com/i0natan/nodebestpractices

import 'source-map-support/register'
import * as https from 'https'
import { SERVER_CONFIG, connectDB, logger } from './shared'
import { app } from './app'
import { connection } from 'mongoose'

// Destructuring
const { cert, host, key, port } = SERVER_CONFIG
// Shorthand Properties
const credentials = { key, cert }

// Arrow Function
const sigintCb = () => {
    logger.info('Server wird heruntergefahren...')
    connection.close(() => {
        // Callback zum Callback
        logger.info(
            'Default-Verbindung zu MongoDB wurde wegen <Strg>C geschlossen.',
        )
        process.exit(0)
    })
}
const unhandledRejectionCb = (err: any) => {
    logger.error(err)
    connection.close(() => {
        logger.info(
            'Verbindung zu MongoDB wegen "unhandledRejection" geschlossen.',
        )
        process.exit(1)
    })
}
const startServer = async () => {
    // await erfordert eine asynchrone Funktion
    await connectDB()

    // https://stackoverflow.com/questions/11744975/enabling-https-on-express-js#answer-11745114
    https
        .createServer(credentials, app as any)
        .listen(port, () =>
            logger.info(
                `https://${host}:${port} ist gestartet: Herunterfahren durch <Strg>C`,
            ),
        )

    process.on('SIGINT', sigintCb)
    process.on('unhandledRejection', unhandledRejectionCb)
}
startServer()
