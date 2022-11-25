import crypto from 'node:crypto'
import { encode } from 'hi-base32'
import QR from 'qrcode'
import _totp from 'totp-generator'
import { Request, Response } from 'express'

export interface TotpOptions {
  /** The issuer for your app (required) */
  issuer: string
  /** The time it takes for a new token to generate, in seconds. Defaults to 30 */
  period?: number | undefined
  /**
   * The desired SHA variant (SHA-1, SHA-224, SHA-256, SHA-384, SHA-512,
   * SHA3-224, SHA3-256, SHA3-384, SHA3-512, SHAKE128, or SHAKE256).
   */
  algorithm?:
    | 'SHA-1'
    | 'SHA-224'
    | 'SHA-256'
    | 'SHA-384'
    | 'SHA-512'
    | 'SHA3-224'
    | 'SHA3-256'
    | 'SHA3-384'
    | 'SHA3-512'
    | 'SHAKE128'
    | 'SHAKE256'
  /** Amount of token digits to use. Defaults to 6 */
  digits?: number | undefined
  /** The epoch time. Defaults to 0 (unix epoch) */
  timestamp?: number | undefined
}

export interface UserData<U> {
  /** The user object that will get injected into further requests. */
  user: U
  /** The secret key of the user, used for generating a comparison key. */
  secret: string
  /** The username used for generating the token URL/QR. */
  username: string
}

type PromiseOrValue<T> = T | Promise<T>

export interface TotpApiOptions<U> {
  /**
   * If the return value is not `undefined`, it uses this function to verify and then inject the correct user into further
   * requests in a middleware (usually before request processing).
   *
   * This is where you would decide which users this request belongs to, via whatever method you want - going into DB,
   * checking headers, etc.
   *
   * - The `user` property of the return value will be injected into further requests.
   * - The `secret` property of the return value will be used to generate a comparison key.
   * - The `username` property of the return value will be used to generate the token URL/QR.
   *
   * Returning `undefined` will cause the request to continue as normal, without any user injected.
   *
   * It is up to you to return an error in the actual request if necessary.
   *
   * @param {Request} req The request object.
   */
  getUser(req: Request): PromiseOrValue<UserData<U> | undefined>

  /**
   * This function should return the token from the request (e.g. from a header, or from a query parameter).
   *
   * @param {Request} req The request object.
   * @returns {string | undefined} The token from the request, or `undefined` if it doesn't exist.
   */
  getToken?(req: Request): PromiseOrValue<string | undefined>
}

export interface TotpMiddlewares {
  /**
   * Middleware for authenticating a user, using their secret and the token provided in the request.
   *
   * Use `getUser` in the options to control which user gets used for comparing the token to and later injected into
   * further requests.
   *
   * Use `getToken` in the options to control how the token is fetched in the request (query, headers, etc).
   */
  authenticate(): (req: Request, res: Response, next: () => void) => Promise<void>

  /**
   * Function for generating a secret URL for a user from a given `secret` and `username`.
   *
   * @param {string} username The username to use for generating the URL.
   * @param {string} secret The secret to use for generating the URL.
   *
   * @returns {string} The URL for the user.
   */
  generateSecretURL(username: string, secret: string): Promise<string>

  /**
   * Function for generating a QR code for a user from a given `secret` and `username`.
   *
   * This returns a PNG image as a data URL.
   *
   * @param {string} username The username to use for generating the URL.
   * @param {string} secret The secret to use for generating the URL.
   *
   * @returns {Promise<string>} The QR code as a data URL.
   */
  generateSecretQR(username: string, secret: string): Promise<string>

  /**
   * Function for generating a QR code for a user from a given `secret` and `username`.
   *
   * This writes the QR code directly to a file, which you can later use to serve to the user.
   *
   * @param {string} username The username to use for generating the URL.
   * @param {string} secret The secret to use for generating the URL.
   * @param {string} filename The path of the file to write the QR image to.
   */
  generateSecretQR(username: string, secret: string, filename: string): Promise<void>

  /**
   * Function for generating a QR code for a user from a given `secret` and `username`.
   *
   * If `filename` is provided, this writes the QR code directly to that path, which you can later use to serve to the user.
   * If `filename` is omitted (or blank), this returns a PNG image as a data URL.
   *
   * @param {string} username The username to use for generating the URL.
   * @param {string} secret The secret to use for generating the URL.
   * @param {string} filename If provided, will use as path of the file to write the QR image to.
   */
  generateSecretQR(username: string, secret: string, filename?: string): Promise<string | void>

  /**
   * Generates a random, 32-byte secret key. You can attach this to your user object or DB however you want.
   */
  generateNewSecret(): Promise<string>
}

function base32secret(length = 32) {
  return encode(crypto.randomBytes(32)).slice(0, length)
}

type OTPUriParams = Record<'secret' | 'issuer' | 'username', string>

function generateTokenUri({ secret, issuer, username }: OTPUriParams) {
  const uri = new URL('otpauth://totp/')
  uri.searchParams.set('secret', secret)
  uri.searchParams.set('issuer', issuer)
  uri.searchParams.set('algorithm', 'SHA1')
  uri.searchParams.set('digits', '6')
  uri.searchParams.set('period', '30')
  uri.searchParams.set('account', username)
  uri.username = issuer
  uri.password = username
  return uri.toString()
}

function generateQR(uri: string, filename?: string): Promise<string> | Promise<void> {
  if (!filename) {
    return new Promise<string>((resolve, reject) => {
      QR.toDataURL(uri, (err, uri) => {
        if (err) {
          reject(err)
          return
        }
        resolve(uri)
      })
    })
  }

  return new Promise<void>((resolve, reject) => {
    QR.toFile(filename, uri, (err) => {
      if (err) {
        reject(err)
        return
      }
      resolve()
    })
  })
}

const defaultOptions: Omit<TotpOptions & TotpApiOptions<unknown>, 'issuer' | 'getUser'> = {
  digits: 6,
  period: 30,
  algorithm: 'SHA-1',
  getToken: (req) => req.query.token as string,
}

export default function totp<U>(_options: TotpOptions & TotpApiOptions<U>): TotpMiddlewares {
  const options = {
    ...defaultOptions,
    ..._options,
  } as Required<TotpOptions & TotpApiOptions<U>>

  async function authenticate(req: Request, res: Response, next: () => void): Promise<void> {
    const resp = await options.getUser(req)
    if (!resp) {
      res.status(401)
      res.send('Unauthorized')
      res.end()
      return
    }
    const { user, secret } = resp
    const token = await options.getToken(req)

    if (token) {
      if (_totp(secret, options) !== token) {
        res.status(400)
        res.send('Invalid token')
        res.end()
        return
      }

      req.user = user
    }

    next()
  }

  async function generateSecretURL(username: string, secret: string): Promise<string> {
    return generateTokenUri({
      secret,
      issuer: options.issuer,
      username,
    })
  }

  async function generateSecretQR(
    username: string,
    secret: string,
    filename?: string,
  ): Promise<never> {
    const uri = generateTokenUri({
      secret,
      issuer: options.issuer,
      username,
    })

    return generateQR(uri, filename) as Promise<never>
  }

  async function generateNewSecret(): Promise<string> {
    return base32secret()
  }

  return {
    authenticate: () => authenticate,
    generateSecretURL,
    generateSecretQR,
    generateNewSecret,
  }
}
