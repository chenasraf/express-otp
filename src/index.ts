import crypto from 'node:crypto'
import { encode } from 'hi-base32'
import QR from 'qrcode'
import _totp from 'totp-generator'
import { Request, Response } from 'express'

export interface TotpOptions {
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
  digits?: number | undefined
  timestamp?: number | undefined
}

export interface UserData<U> {
  user: U
  secret: string
  username: string
}

type PromiseOrValue<T> = T | Promise<T>

export interface TotpApiOptions<U> {
  issuer: string
  getUser(req: Request): PromiseOrValue<UserData<U> | undefined>
  getToken?(req: Request): PromiseOrValue<string>
}

export interface TotpMiddlewares {
  authenticate: () => (req: Request, res: Response, next: () => void) => Promise<void>
  generateTokenURL: () => (req: Request, res: Response, next: () => void) => Promise<void>
  generateTokenQR: () => (req: Request, res: Response, next: () => void) => Promise<void>
  createToken: () => (req: Request, res: Response, next: () => void) => Promise<void>
}

export function base32secret(length = 32) {
  return encode(crypto.randomBytes(32)).slice(0, length)
}

export type OTPUriParams = Record<'secret' | 'issuer' | 'username', string>

export function generateTokenUri({ secret, issuer, username }: OTPUriParams) {
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

export function generateQR(uri: string): Promise<string> {
  return new Promise((resolve, reject) => {
    QR.toDataURL(uri, (err, uri) => {
      if (err) {
        reject(err)
        return
      }
      resolve(uri)
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

  async function authenticate(req: Request, res: Response, next: () => void) {
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

  async function generateTokenURL(req: Request, res: Response) {
    const resp = await options.getUser(req)
    if (!resp) {
      res.status(401)
      res.send('Unauthorized')
      res.end()
      return
    }
    const { username, secret } = resp

    if (!secret || !username) {
      res.status(400)
      res.send('Invalid secret or username')
      res.end()
      return
    }

    const uri = generateTokenUri({
      secret,
      issuer: options.issuer,
      username,
    })

    res.setHeader('Content-Type', 'text/plain')
    res.status(200)
    res.send(uri)
  }

  async function generateTokenQR(req: Request, res: Response) {
    const resp = await options.getUser(req)
    if (!resp) {
      res.status(401)
      res.send('Unauthorized')
      res.end()
      return
    }
    const { username, secret } = resp

    if (!secret || !username) {
      res.status(400)
      res.send('Invalid secret or username')
      res.end()
      return
    }

    const uri = generateTokenUri({
      secret,
      issuer: options.issuer,
      username,
    })

    res.setHeader('Content-Type', 'text/plain')
    res.status(200)
    res.send(await generateQR(uri))
  }

  async function createToken(req: Request, res: Response) {
    res.setHeader('Content-Type', 'text/plain')
    res.status(200)
    res.send(base32secret())
  }

  return {
    authenticate: () => authenticate,
    generateTokenURL: () => generateTokenURL,
    generateTokenQR: () => generateTokenQR,
    createToken: () => createToken,
  }
}
