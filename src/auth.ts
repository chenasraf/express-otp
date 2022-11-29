import crypto from 'node:crypto'
import fs from 'fs/promises'
import path from 'path'
import { encode } from 'hi-base32'
import QR from 'qrcode'
import _totp from 'totp-generator'
import { NextFunction, Request, Response } from 'express'
import { AuthOptions, TotpApiOptions, TotpMiddlewares, TotpOptions, UserData } from './types'
import { OTPError } from './error'

const defaultOptions: Omit<TotpOptions & TotpApiOptions<unknown>, 'issuer' | 'getUser'> = {
  digits: 6,
  period: 30,
  algorithm: 'SHA-1',
  getToken: (req) => req.query.token as string,
  tokenFormOptions: {},
}

export default function totp<U>(_options: TotpOptions & TotpApiOptions<U>): TotpMiddlewares<U> {
  const options = {
    ...defaultOptions,
    ..._options,
  } as Required<TotpOptions & TotpApiOptions<U>>

  function authenticate(
    _options?: AuthOptions<U>,
  ): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    return (req, res, next) => _authenticate<U>(req, res, next, { ...options, ..._options })
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
    authenticate,
    generateSecretURL,
    generateSecretQR,
    generateNewSecret,
    verifyToken,
    verifyUser,
  }
}

function _generateQR(uri: string, filename?: string): Promise<string> | Promise<void> {
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

function _generateSecretQR<U>(
  options: Required<TotpOptions & TotpApiOptions<U>>,
  username: string,
  secret: string,
  filename: string | undefined,
) {
  const uri = _generateSecretURL(options, username, secret)
  return _generateQR(uri, filename) as Promise<never>
}

function _generateSecretURL<U>(
  options: Required<TotpOptions & TotpApiOptions<U>>,
  username: string,
  secret: string,
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
  console.log('🚀 ~ file: auth.ts ~ line 167 ~ options', options)

  if (!token) {
    if (options.tokenForm) {
      if (options.tokenForm === true) {
        const tokenFormFile = await _renderTokenTemplate<U>(options)
        res.setHeader('X-Requires-OTP', 'true').status(200).send(tokenFormFile)
        return
      }
      options.tokenForm(req, res)
      return
    }
    return _respondWithError(req, res, next, new OTPError('no_token'), options)
  }

  if (!resp?.user) {
    return _respondWithError(req, res, next, new OTPError('no_user'), options)
  }

  if (!user) {
    return _respondWithError(req, res, next, new OTPError('invalid_token'), options)
  }

  req.user = user
  next(null)
}

async function _renderTokenTemplate<U>(options: Required<TotpOptions & TotpApiOptions<U>>) {
  const tokenFormFileRaw = await fs.readFile(
    path.join(__dirname, 'views', 'get_token.html'),
    'utf-8',
  )
  const tokenFormFile = tokenFormFileRaw
    .replace('{{title}}', options.tokenFormOptions.texts?.title || 'OTP Authentication')
    .replace('{{promptTitle}}', options.tokenFormOptions.texts?.promptTitle || 'Enter your token')
    .replace('{{promptDescription}}', options.tokenFormOptions.texts?.promptDescription || '')
    .replace('{{submitButton}}', options.tokenFormOptions.texts?.submitButton || 'Submit')
    .replace('/*{{css}}*/', options.tokenFormOptions.css || '')
    .replace('/*{{js}}*/', options.tokenFormOptions.js || '')
    .replace('<!-- {{prependHtml}} -->', options.tokenFormOptions.prependHtml || '')
    .replace('<!-- {{appendHtml}} -->', options.tokenFormOptions.appendHtml || '')

  return tokenFormFile
}

function _respondWithError<U>(
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
