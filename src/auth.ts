import fs from 'fs/promises'
import path from 'path'
import { NextFunction, Request, Response } from 'express'
import { AllOptions, AuthOptions, defaultOptions, TotpApiOptions, TotpMiddlewares, TotpOptions } from './types'
import { OTPError } from './error'
import { _generateSecret, _generateSecretQR, _generateSecretURL, _verifyToken, _verifyUser } from './token'
import { PassportOTPStrategy, PassportOTPStrategyOptions } from './passport'

/**
 * Main TOTP function. Use this to generate the middleware and additional (optional) functions for TOTP authentication.
 * @param options The totp options object
 * @returns The totp middlewares object
 */
export default function totp<U>(options: TotpOptions & TotpApiOptions<U>): TotpMiddlewares<U> {
  const mergedOptions = {
    ...defaultOptions,
    ...options,
  } as Required<TotpOptions & TotpApiOptions<U>>

  // authentication method from given options
  function authenticate(
    overrideOptions?: AuthOptions<U>,
  ): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    return (req, res, next) => _authenticate<U>(req, res, next, { ...mergedOptions, ...overrideOptions })
  }

  // verify user from given options
  async function verifyUser(req: Request): Promise<U | undefined> {
    const resp = await mergedOptions.getUser(req)
    return _verifyUser(mergedOptions, req, resp)
  }

  // verify token from given options
  function verifyToken(secret: string, token: string): boolean {
    return _verifyToken(mergedOptions, secret, token)
  }

  // generate secret URL from given options
  function generateSecretURL(username: string, secret: string): string {
    return _generateSecretURL(mergedOptions, secret, username)
  }

  // generate secret QR from given options
  async function generateSecretQR(username: string, secret: string, filename?: string): Promise<never> {
    return _generateSecretQR(mergedOptions, username, secret, filename) as Promise<never>
  }

  // generate secret
  function generateNewSecret(): string {
    return _generateSecret()
  }

  // passport strategy
  function passport(optionsOverrides: Partial<AllOptions<U>>): PassportOTPStrategy<U> {
    return new PassportOTPStrategy({ ...mergedOptions, ...optionsOverrides })
  }

  // output
  return {
    authenticate,
    generateSecretURL,
    generateSecretQR,
    generateNewSecret,
    verifyToken,
    verifyUser,
    passport,
  }
}

/**
 * Authenticate the user using the given options
 * @hidden
 * @param req The request object
 * @param res The response object
 * @param next The next function
 * @param options The totp options object
 */
export async function _authenticate<U>(
  req: Request,
  res: Response,
  next: NextFunction,
  options: Required<TotpOptions & TotpApiOptions<U>>,
): Promise<void> {
  const token = await options.getToken(req)
  const resp = await options.getUser(req)
  const user = await _verifyUser(options, req, resp)

  // if token is not provided, render the token form or an error
  if (!token) {
    // if there is a token form, render it
    if (options.tokenForm) {
      return _sendTokenFormTemplate(options, req, res)
    }

    // no token form, return an error
    return _respondWithError(req, res, next, new OTPError('no_token'), options)
  }

  // if user is not found, return an error
  if (!resp?.user) {
    return _respondWithError(req, res, next, new OTPError('no_user'), options)
  }

  // if user is not verified, return an error
  if (!user) {
    return _respondWithError(req, res, next, new OTPError('invalid_token'), options)
  }

  // if all is good, save user to request
  req.user = user

  // proceed to next middleware
  next(null)
}

/**
 * Send the default token form template after rendering it with given options
 * @param options The totp options object
 * @param res The response object
 */
async function _sendTokenFormTemplate<U>(
  options: Required<Pick<TotpApiOptions<U>, 'tokenFormOptions' | 'tokenForm'>>,
  req: Request,
  res: Response,
): Promise<void> {
  if (!options.tokenForm) {
    return
  }

  // default token form
  if (options.tokenForm === true) {
    const tokenFormFile = await _renderTokenTemplate<U>(options)
    res.setHeader('X-Requires-OTP', 'true').status(200).send(tokenFormFile)
    return
  }

  // custom token form
  return options.tokenForm(req, res)
}

/**
 * Render the default token form template, replacing the placeholders with the given options
 *
 * @param options The totp options object
 * @returns The rendered token form template
 */
async function _renderTokenTemplate<U>(options: Required<Pick<TotpApiOptions<U>, 'tokenFormOptions'>>) {
  // get template contents from file
  const tokenFormFileRaw = await fs.readFile(
    // __dirname is the directory of this file, not the runtime directory
    path.join(__dirname, 'views', 'get_token.html'),
    'utf-8',
  )

  const { texts = {}, prependHtml, appendHtml, js, css } = options.tokenFormOptions

  // replace template variables
  const tokenFormFile = tokenFormFileRaw
    .replace('{{title}}', texts.title || 'OTP Authentication')
    .replace('{{promptTitle}}', texts.promptTitle || 'Enter your token')
    .replace('{{promptDescription}}', texts.promptDescription || '')
    .replace('{{submitButton}}', texts.submitButton || 'Submit')
    .replace('/*{{css}}*/', css || '')
    .replace('/*{{js}}*/', js || '')
    .replace('<!-- {{prependHtml}} -->', prependHtml || '')
    .replace('<!-- {{appendHtml}} -->', appendHtml || '')

  // return the parsed file contents
  return tokenFormFile
}

/**
 * Wrapper to respond with an error. If `options.errorResponse` is provided, it will be used. Otherwise, the error
 * will be passed to `next` middleware.
 *
 * @hidden
 * @param req The request object
 * @param res The response object
 * @param next The next function
 * @param error The error object
 * @param options The totp options object
 */
function _respondWithError<U>(
  req: Request,
  res: Response,
  next: NextFunction,
  error: OTPError,
  options: TotpOptions & TotpApiOptions<U>,
): void {
  if (options.errorResponse !== undefined) {
    options.errorResponse(req, res, next, error)
    if (!res.writableEnded) {
      res.end()
    }
    return
  }
  next(error)
}
