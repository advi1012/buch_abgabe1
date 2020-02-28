/*
 * Copyright (C) 2017 - present Juergen Zimmermann, Hochschule Karlsruhe
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

import * as fs from 'fs-extra'
import * as path from 'path'

import { dir } from './shared'

const { src, config, dist } = dir
const serverSrc = path.join(src, 'server')
const serverDist = path.join(dist, 'server')

// JSON-Dateien kopieren
const jsonSrc = path.join(serverSrc, 'auth', 'service', 'json')
const jsonDist = path.join(serverDist, 'auth', 'service', 'json')
fs.copy(jsonSrc, jsonDist, err => {
    if (err) {
        console.error(err)
    }
})

// PEM-Dateien fuer JWT kopieren
const jwtPemSrc = path.join(serverSrc, 'auth', 'service', 'jwt')
const jwtPemDist = path.join(serverDist, 'auth', 'service', 'jwt')
fs.copy(jwtPemSrc, jwtPemDist, err => {
    if (err) {
        console.error(err)
    }
})

// PEM- und Zertifikatdateien fuer HTTPS kopieren
const httpsSrc = path.join(config, 'https')
const httpsDist = path.join(serverDist, 'shared', 'config')
fs.copy(httpsSrc, httpsDist, err => {
    if (err) {
        console.error(err)
    }
})

// Zertifikatdatei fuer MongoDB kopieren
const mongoSrc = path.join(config, 'db', 'mongodb.cer')
const mongoDist = path.join(serverDist, 'shared', 'config', 'mongodb.cer')
fs.copy(mongoSrc, mongoDist, err => {
    if (err) {
        console.error(err)
    }
})

// Konfig-Dateien fuer Nodemon kopieren
const nodemonSrc = path.join(config, 'nodemon')
fs.copy(nodemonSrc, serverDist, err => {
    if (err) {
        console.error(err)
    }
})

// -----------------------------------------------------------------------------
// E J S
// -----------------------------------------------------------------------------

// Views mit Partials
const viewsSrc = path.join(serverSrc, 'views')
const viewsDist = path.join(serverDist, 'views')
fs.copy(viewsSrc, viewsDist, err => {
    if (err) {
        console.error(err)
    }
})

// Fontawesome, Bilder, Favicon, manifest.json, robots.txt
const publicSrc = path.join(serverSrc, 'public')
const publicDist = path.join(serverDist, 'public')
fs.copy(publicSrc, publicDist, err => {
    if (err) {
        console.error(err)
    }
})

// Bootstrap
const bootstrapCssSrc = path.join(
    'node_modules',
    'bootstrap',
    'dist',
    'css',
    'bootstrap.min.css',
)
const bootstrapCssDist = path.join(
    serverDist,
    'public',
    'css',
    'bootstrap.min.css',
)
fs.copy(bootstrapCssSrc, bootstrapCssDist, err => {
    if (err) {
        console.error(err)
    }
})
const bootstrapJsSrc = path.join(
    'node_modules',
    'bootstrap',
    'dist',
    'js',
    'bootstrap.min.js',
)
const bootstrapJsDist = path.join(
    serverDist,
    'public',
    'js',
    'bootstrap.min.js',
)
fs.copy(bootstrapJsSrc, bootstrapJsDist, err => {
    if (err) {
        console.error(err)
    }
})
const jquerySrc = path.join(
    'node_modules',
    'jquery',
    'dist',
    'jquery.slim.min.js',
)
const jqueryDist = path.join(serverDist, 'public', 'js', 'jquery.slim.min.js')
fs.copy(jquerySrc, jqueryDist, err => {
    if (err) {
        console.error(err)
    }
})
const popperSrc = path.join(
    'node_modules',
    'popper.js',
    'dist',
    'popper.min.js',
)
const popperDist = path.join(serverDist, 'public', 'js', 'popper.min.js')
fs.copy(popperSrc, popperDist, err => {
    if (err) {
        console.error(err)
    }
})

const fontawesomeSrc = path.join('config', 'fontawesome', 'all.min.js')
const fontawesomeDist = path.join(serverDist, 'public', 'js', 'all.min.js')
fs.copy(fontawesomeSrc, fontawesomeDist, err => {
    if (err) {
        console.error(err)
    }
})

// const fontawesomeSvgCoreSrc = path.join(
//     'node_modules',
//     '@fortawesome',
//     'fontawesome-svg-core',
//     'index.es.js',
// )
// const fontawesomeSvgCoreDist = path.join(
//     serverDist,
//     'public',
//     'js',
//     'fontawesome',
//     'index.es.js',
// )
// fs.copy(fontawesomeSvgCoreSrc, fontawesomeSvgCoreDist, err => {
//     if (err) {
//         console.error(err)
//     }
// })

// const faFiles = [
//     'faBook.js',
//     'faChartBar.js',
//     'faChartLine.js',
//     'faChartPie.js',
//     'faFolderOpen.js',
//     'faSearch.js',
// ]
// faFiles.forEach(file => {
//     const faSrc = path.join(
//         'node_modules',
//         '@fortawesome',
//         'free-solid-svg-icons',
//         file,
//     )
//     const fontawesomeDist = path.join(
//         serverDist,
//         'public',
//         'js',
//         'fontawesome',
//         file,
//     )
//     fs.copy(faSrc, fontawesomeDist, err => {
//         if (err) {
//             console.error(err)
//         }
//     })
// })
