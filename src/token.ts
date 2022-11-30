import crypto from 'node:crypto'
import { defaultOptions, TotpApiOptions, TotpOptions, UserData } from './types'
import QR from 'qrcode'
import _totp from 'totp-generator'
import { Request } from 'express'
import { encode } from 'hi-base32'

/**
 * Generate a QR data URL OR file from given URL
 * @param {string} uri url to generae QR from
 * @param {string} filename filename to save to, if not present, returns data URL instead
 * @returns {string | void} data URL if not saved to file. If saved to file, returns nothing
 */
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

/**
 * Generate QR file or data URL from given options
 * @hidden
 * @param options options to generate QR code
 * @param {string} username username to generate QR code for
 * @param {string} secret secret to generate QR code for
 * @param {string | undefined} filename filename to save QR code to, if not present, returns data URL instead
 * @returns {Promise<string | void>} data URL if not saved to file. If saved to file, returns nothing
 */
export function _generateSecretQR(
  options: Required<TotpOptions>,
  username: string,
  secret: string,
  filename: string | undefined,
): Promise<string | void> {
  const uri = _generateSecretURL(options, username, secret)
  return _generateQR(uri, filename) as Promise<never>
}

/**
 * Generate a secret URL from given options
 * @hidden
 * @param options options to generate URL code
 * @param username username to generate URL code for
 * @param secret secret to generate URL code for
 * @returns {string} TOTP secret URL
 */
export function _generateSecretURL(options: Required<TotpOptions>, username: string, secret: string): string {
  const uri = new URL('otpauth://totp/')
  // apply user data
  uri.username = options.issuer
  uri.password = username

  // apply options
  uri.searchParams.set('issuer', options.issuer)
  uri.searchParams.set('account', username)
  uri.searchParams.set('secret', secret)

  // only attach some params if they are different from defaults
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

/**
 * Validates a given request token against a token generated from a given secret
 * @hidden
 * @param options options to verify token
 * @param secret secret to verify token for
 * @param reqToken token to verify
 * @returns {boolean} whether token is valid or not
 */
export function _verifyToken(options: Required<TotpOptions>, secret: string, reqToken: string): boolean {
  const genToken = _totp(secret, options)
  return genToken === reqToken
}

/**
 * Verify a given request and return user if valid
 * @hidden
 * @param options options to get/verify user
 * @param req request to get/verify user for
 * @param userData user data to verify against
 * @returns {Promise<U | undefined>} user data if user is valid, undefined if not
 */
export async function _verifyUser<U>(
  options: Required<TotpOptions & Pick<TotpApiOptions<U>, 'getToken'>>,
  req: Request,
  userData: UserData<U> | undefined,
): Promise<U | undefined> {
  if (!userData) {
    return
  }

  const { user, secret } = userData
  const token = await options.getToken(req)

  // if token exists, verify it
  if (token) {
    if (!_verifyToken(options, secret, token)) {
      return
    }

    return user
  }
}

/**
 * Generate a secret
 * @hidden
 * @returns {string} a random secret
 */
export function _generateSecret(): string {
  return encode(crypto.randomBytes(32)).slice(0, 32)
}
