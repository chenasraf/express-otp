import crypto from 'node:crypto'
import { encode } from 'hi-base32'
import QR from 'qrcode'
import _totp from 'totp-generator'
import { NextFunction, Request, Response } from 'express'
import { TotpApiOptions, TotpMiddlewares, TotpOptions, UserData } from './types'
import { OTPError } from './error'
export * from './types'

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

export default function totp<U>(_options: TotpOptions & TotpApiOptions<U>): TotpMiddlewares<U> {
  const options = {
    ...defaultOptions,
    ..._options,
  } as Required<TotpOptions & TotpApiOptions<U>>

  async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
    _authenticate<U>(req, res, next, options)
  }

  async function verifyUser(req: Request): Promise<U | undefined> {
    const resp = await options.getUser(req)
    return _verifyUser<U>(options, req, resp)
  }

  function verifyToken(secret: string, token: string): boolean {
    return _verifyToken<U>(options, secret, token)
  }

  function generateSecretURL(username: string, secret: string): string {
    return _generateSecretURL<U>(options, secret, username)
  }

  async function generateSecretQR(
    username: string,
    secret: string,
    filename?: string,
  ): Promise<never> {
    return await _generateSecretQR(options, username, secret, filename)
  }

  function generateNewSecret(): string {
    return encode(crypto.randomBytes(32)).slice(0, 32)
  }

  return {
    authenticate: () => authenticate,
    generateSecretURL,
    generateSecretQR,
    generateNewSecret,
    verifyToken,
    verifyUser,
  }
}

function _generateSecretQR<U>(
  options: Required<TotpOptions & TotpApiOptions<U>>,
  username: string,
  secret: string,
  filename: string | undefined,
) {
  const uri = _generateSecretURL(options, username, secret)
  return generateQR(uri, filename) as Promise<never>
}

function _generateSecretURL<U>(
  options: Required<TotpOptions & TotpApiOptions<U>>,
  secret: string,
  username: string,
) {
  const uri = new URL('otpauth://totp/')
  uri.username = options.issuer
  uri.password = username

  uri.searchParams.set('issuer', options.issuer)
  uri.searchParams.set('account', username)
  uri.searchParams.set('secret', secret)

  if (defaultOptions.algorithm !== options.algorithm) {
    uri.searchParams.set('algorithm', options.algorithm)
  }

  if (defaultOptions.digits !== options.digits) {
    uri.searchParams.set('digits', options.digits.toString())
  }

  if (defaultOptions.period !== options.period) {
    uri.searchParams.set('period', options.period.toString())
  }

  return uri.toString()
}

function _verifyToken<U>(
  options: Required<TotpOptions & TotpApiOptions<U>>,
  secret: string,
  reqToken: string,
) {
  const genToken = _totp(secret, options)
  return genToken === reqToken
}

async function _verifyUser<U>(
  options: Required<TotpOptions & TotpApiOptions<U>>,
  req: Request,
  userData: UserData<U> | undefined,
): Promise<U | undefined> {
  if (!userData) {
    return
  }

  const { user, secret } = userData
  const token = await options.getToken(req)

  if (token) {
    if (!_verifyToken(options, secret, token)) {
      return
    }

    return user
  }
}

async function _authenticate<U>(
  req: Request,
  res: Response,
  next: NextFunction,
  options: Required<TotpOptions & TotpApiOptions<U>>,
) {
  const token = await options.getToken(req)
  const resp = await options.getUser(req)
  const user = await _verifyUser(options, req, resp)

  if (!token) {
    return respondWithError(req, res, next, new OTPError('no_token'), options)
  }

  if (!resp?.user) {
    return respondWithError(req, res, next, new OTPError('no_user'), options)
  }

  if (!user) {
    return respondWithError(req, res, next, new OTPError('invalid_token'), options)
  }

  req.user = user
  next(null)
}

function respondWithError<U>(
  req: Request,
  res: Response,
  next: NextFunction,
  error: OTPError,
  options: TotpOptions & TotpApiOptions<U>,
) {
  if (options.errorResponse !== undefined) {
    options.errorResponse(req, res, next, error)
    if (!res.writableEnded) {
      res.end()
    }
    return
  }
  next(error)
}
