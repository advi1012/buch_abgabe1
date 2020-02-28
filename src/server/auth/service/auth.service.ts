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

// UUID v4: random, UUID v5: namespace
// https://github.com/kelektiv/node-uuid
import * as uuidv4 from 'uuid/v4'
import { Header, SignOptions, Signature, decode, sign, verify } from 'jws'
// Statt JWT (nahezu) komplett zu implementieren, koennte man z.B. Passport
// verwenden
import { JWT_CONFIG, SALT_ROUNDS, alg, log, logger } from '../../shared'
// Alternativen zu bcrypt:
//  scrypt: https://www.tarsnap.com/scrypt.html
//  Argon2: https://github.com/p-h-c/phc-winner-argon2
//  SHA-Algorithmen und PBKDF2 sind anfaelliger bei Angriffen mittels GPUs
//  http://blog.rangle.io/how-to-store-user-passwords-and-overcome-security-threats-in-2017
//  https://stormpath.com/blog/secure-password-hashing-in-node-with-argon2
import { compare, hash } from 'bcrypt'
import { Request } from 'express'
import { RolesService } from './roles.service'
import { UsersService } from './users.service'
import { join } from 'path'
import { readFileSync } from 'fs'

export interface LoginResult {
    token: string
    token_type: string // eslint-disable-line camelcase
    expires_in: number // eslint-disable-line camelcase
    roles?: Array<string>
}

export class AuthService {
    private static RSA_PRIVATE_KEY = readFileSync(
        join(__dirname, 'jwt', 'rsa.pem'),
    )
    private static RSA_PUBLIC_KEY = readFileSync(
        join(__dirname, 'jwt', 'rsa.public.pem'),
    )
    private static ECDSA_PRIVATE_KEY = readFileSync(
        join(__dirname, 'jwt', 'ecdsa.pem'),
    )
    private static ECDSA_PUBLIC_KEY = readFileSync(
        join(__dirname, 'jwt', 'ecdsa.public.pem'),
    )

    private readonly rolesService = new RolesService()
    private readonly usersService = new UsersService()

    // mit Ideen von der Function sign() im Package express-jwt
    @log
    async login(req: Request) {
        logger.silly(`body: ${JSON.stringify(req.body)}`)
        const username: string = req.body.username // eslint-disable-line prefer-destructuring
        logger.silly(`username: ${username}`)
        if (username === undefined) {
            return undefined
        }
        const user = this.usersService.findByUsername(username)
        logger.silly(`user: ${JSON.stringify(user)}`)

        const password: string = req.body.password // eslint-disable-line prefer-destructuring
        logger.silly(`password: ${password}`)
        const passwordCheck = await this.checkPassword(user, password)
        if (!passwordCheck) {
            return undefined
        }

        const header: Header = { alg }
        // akt. Datum in Sek. seit 1.1.1970 UTC
        const nowSeconds = this.nowSeconds()
        const payload = {
            // issued at (in Sek. seit 1.1.1970 UTC)
            iat: nowSeconds,
            // issuer
            iss: JWT_CONFIG.issuer,
            // subject (ID aus LDAP oder Active Directory, NICHT username o.ae.)
            sub: user._id,
            // JWT ID (hier: als generierte UUIDv4)
            jti: uuidv4(),
            // expiration time
            exp: nowSeconds + JWT_CONFIG.expiration,
            // nbf = not before
        }
        logger.silly(`payload: ${JSON.stringify(payload)}`)

        let secretOrPrivateKey: string | Buffer | undefined = undefined
        if (this.isHMAC()) {
            secretOrPrivateKey = JWT_CONFIG.secret
        } else if (this.isRSA()) {
            secretOrPrivateKey = AuthService.RSA_PRIVATE_KEY
        } else if (this.isECDSA()) {
            secretOrPrivateKey = AuthService.ECDSA_PRIVATE_KEY
        }
        const signOptions: SignOptions = {
            header,
            payload,
            secret: secretOrPrivateKey as string | Buffer,
            encoding: JWT_CONFIG.encoding,
        }
        const token = sign(signOptions)

        /* eslint-disable @typescript-eslint/camelcase */
        const loginResult: LoginResult = {
            token,
            token_type: JWT_CONFIG.bearer, // eslint-disable-line camelcase
            expires_in: JWT_CONFIG.expiration, // eslint-disable-line camelcase
            roles: user.roles,
        }
        /* eslint-enable @typescript-eslint/camelcase */

        return loginResult
    }

    // Mit Ideen von der Function verify() im Package express-jwt
    // Exceptions bzw. Errors gemaess OAuth 2
    //  https://tools.ietf.org/html/rfc6749#section-5.2
    //  https://tools.ietf.org/html/rfc6750#section-3.1
    @log
    validateJwt(req: Request) {
        // Die "Field Names" beim Request Header unterscheiden nicht zwischen
        // Gross- und Kleinschreibung (case-insensitive)
        // https://tools.ietf.org/html/rfc7230
        // http://www.w3.org/Protocols/rfc2616/rfc2616-sec4.html#sec4.2
        const auth = req.header('Authorization')

        // Keine "Timing Attack" durch zeichenweises Vergleichen, wenn
        // unterschiedliche Antwortzeiten bei 403 entstehen
        // https://snyk.io/blog/node-js-timing-attack-ccc-ctf
        // Eine von Error abgeleitete Klasse hat die Property "message"
        if (auth === undefined) {
            logger.silly('Kein Header-Field Authorization')
            throw new AuthorizationInvalidError(
                'Kein Header-Field Authorization',
            )
        }
        logger.silly(`Authorization = ${auth}`)

        // Destructuring
        const [scheme, tokenString] = auth.split(' ')
        if (tokenString === undefined) {
            logger.silly(
                `Fehler beim Header-Field Authorization: ${JSON.stringify(
                    auth,
                )}`,
            )
            throw new AuthorizationInvalidError(
                `Fehler beim Header-Field Authorization: ${JSON.stringify(
                    auth,
                )}`,
            )
        }

        // "Bearer" ist case-insensitiv
        // https://tools.ietf.org/html/rfc6750#page-7
        const bearerRegExp = RegExp(`^${JWT_CONFIG.bearer}$`, 'i')
        if (scheme.match(bearerRegExp) === null) {
            logger.silly(
                'Das Schema beim Header-Field Authorization muss ' +
                    `${JWT_CONFIG.bearer} sein`,
            )
            // Eine von Error abgeleitete Klasse hat die Property "message"
            throw new TokenInvalidError(
                'Das Schema beim Header-Field Authorization muss ' +
                    `${JWT_CONFIG.bearer} sein`,
            )
        }

        const [, payloadBase64, signatureBase64] = tokenString.split('.')
        if (signatureBase64 === undefined) {
            logger.silly('Der Token besteht nicht aus 3 Teilen.')
            throw new TokenInvalidError('Der Token besteht nicht aus 3 Teilen.')
        }
        if (payloadBase64.trim() === '') {
            logger.silly('Die Payload des Tokens ist leer.')
            throw new TokenInvalidError('Die Payload des Tokens ist leer.')
        }

        let tokenDecoded: Signature | null = null
        try {
            tokenDecoded = decode(tokenString)
            // Optional catch binding parameters
        } catch {
            logger.silly('Der JWT-Token kann nicht decodiert werden')
            throw new TokenInvalidError(
                'Der JWT-Token kann nicht decodiert werden',
            )
        }
        if (tokenDecoded === null) {
            logger.silly(
                'Decodieren des Token-Strings liefert kein Token-Objekt',
            )
            throw new TokenInvalidError(
                'Decodieren des Token-Strings liefert kein Token-Objekt',
            )
        }
        logger.silly(
            `Der JWT-Token wurde decodiert: ${JSON.stringify(tokenDecoded)}`,
        )

        // Destructuring
        const { header, payload } = tokenDecoded
        if (header.alg !== alg) {
            logger.silly(`Falscher Algorithmus im Header: ${header.alg}`)
            throw new TokenInvalidError(
                `Falscher Algorithmus im Header: ${header.alg}`,
            )
        }

        let secretOrPublicKey: string | Buffer | undefined = undefined
        if (this.isHMAC()) {
            secretOrPublicKey = JWT_CONFIG.secret
        } else if (this.isRSA()) {
            secretOrPublicKey = AuthService.RSA_PUBLIC_KEY
        } else if (this.isECDSA()) {
            secretOrPublicKey = AuthService.ECDSA_PUBLIC_KEY
        }

        let valid = true
        try {
            valid = verify(tokenString, header.alg, secretOrPublicKey as
                | string
                | Buffer)
        } catch {
            logger.silly(
                `Der Token-String ist mit ${header.alg} nicht verifizierbar`,
            )
            throw new TokenInvalidError(
                `Der Token-String ist mit ${header.alg} nicht verifizierbar`,
            )
        }
        if (!valid) {
            throw new TokenInvalidError(`Ungueltiger Token: ${tokenString}`)
        }

        logger.silly(`payload: ${payload}`)
        const { exp, iss, sub } = JSON.parse(payload)
        if (
            exp === undefined ||
            typeof exp !== 'number' ||
            this.nowSeconds() >= exp
        ) {
            logger.silly(
                `Der Token ist abgelaufen: exp=${exp}, now=${this.nowSeconds()}`,
            )
            throw new TokenExpiredError(`Abgelaufener Token: ${exp}`)
        }
        logger.silly(`exp=${exp}`)
        logger.silly(`iss=${iss}`)
        logger.silly(`sub=${sub}`)

        if (iss !== JWT_CONFIG.issuer) {
            logger.silly(`Falscher issuer: ${iss}`)
            throw new TokenInvalidError(`Falscher issuer: ${iss}`)
        }

        const user = this.usersService.findById(sub)
        if (user === undefined) {
            logger.silly(`Falsche User-Id: ${sub}`)
            throw new TokenInvalidError(`Falsche User-Id: ${sub}`)
        }

        // Request-Objekt um userId erweitern:
        // fuer die spaetere Ermittlung der Rollen nutzen
        const tmp: any = req
        tmp.userId = sub
        logger.silly(`userId: ${sub}`)
    }

    // bereits erledigt durch Validierung des Tokens
    // Basic Authentifizierung: ueberladen bzw. neu implementieren
    /* eslint-disable @typescript-eslint/no-unused-vars */
    @log
    isLoggedIn(_: Request) {
        return true
    }
    /* eslint-enable @typescript-eslint/no-unused-vars */

    @log
    hasAnyRole(req: Request, roles: Array<string>) {
        const tmp = req as any
        const user = this.usersService.findById(tmp.userId)
        const rolesNormalized = this.rolesService.getNormalizedRoles(roles)
        return this.userHasAnyRole(user, rolesNormalized)
    }

    @log
    userHasAnyRole(user: any, roles: Array<string>) {
        if (user === undefined || user.roles === undefined) {
            return false
        }
        if (roles.length === 0) {
            return true
        }

        const userRoles = user.roles as Array<string>
        return roles.filter(role => userRoles.includes(role)).length !== 0
    }

    @log
    async checkPassword(user: any, password: string) {
        if (user === undefined) {
            logger.silly('Kein User-Objekt')
            return Promise.resolve(false)
        }

        // Beispiel:
        //  $2a$12$50nIBzoTSmFEDGI8nM2iYOO66WNdLKq6Zzhrswo6p1MBmkER5O/CO
        //  $ als Separator
        //  2a: Version von bcrypt
        //  12: 2**12 Iterationen mit dem
        //  die ersten 22 Zeichen kodieren einen 16-Byte Wert fuer den Salt
        //  danach das chiffrierte Passwort
        const result = await compare(password, user.password)
        logger.silly(`result: ${result}`)
        return result
    }

    @log
    register(req: Request) {
        const body: any = { req }
        logger.silly(`username: ${body.username}`)
        const password = { body }
        logger.silly(`password: ${password}`)

        hash(password, SALT_ROUNDS, (_, encrypted) =>
            // encrypted enthaelt den Hashwert *und* Salt
            logger.error(`encrypted: ${encrypted}`),
        )
    }

    toString() {
        return 'AuthService'
    }

    private nowSeconds() {
        return Math.floor(Date.now() / 1000) // eslint-disable-line no-magic-numbers
    }

    // HMAC = Keyed-Hash MAC (= Message Authentication Code)
    private isHMAC() {
        return alg.startsWith('HS')
    }

    // RSA = Ron Rivest, Adi Shamir, Leonard Adleman
    private isRSA() {
        return alg.startsWith('RS')
    }

    // ECDSA = elliptic curve digital signature algorithm
    private isECDSA() {
        return alg.startsWith('ES')
    }
}

// http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript#answer-5251506
// https://developer.mozilla.org/de/docs/Web/JavaScript/Reference/Global_Objects/Error

export class AuthorizationInvalidError implements Error {
    name = 'AuthorizationInvalidError'

    constructor(public message: string) {
        logger.silly('AuthorizationInvalidError.constructor()')
    }
}

export class TokenInvalidError implements Error {
    name = 'TokenInvalidError'

    constructor(public message: string) {
        logger.silly('TokenInvalidError.constructor()')
    }
}

export class TokenExpiredError implements Error {
    name = 'TokenExpiredError'

    constructor(public message: string) {
        logger.silly('TokenExpiredError.constructor()')
    }
}
