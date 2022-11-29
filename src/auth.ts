import fs from 'fs/promises'
import path from 'path'
import { NextFunction, Request, Response } from 'express'
import { AuthOptions, defaultOptions, TotpApiOptions, TotpMiddlewares, TotpOptions } from './types'
import { OTPError } from './error'
import {
  _generateSecret,
  _generateSecretQR,
  _generateSecretURL,
  _verifyToken,
  _verifyUser,
} from './token'

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
    return _generateSecret()
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
