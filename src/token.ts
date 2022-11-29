import crypto from 'node:crypto'
import { AllOptions, defaultOptions, UserData } from './types'
import QR from 'qrcode'
import _totp from 'totp-generator'
import { Request } from 'express'
import { encode } from 'hi-base32'

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

/** @hidden */
export function _generateSecretQR<U>(
  options: Required<AllOptions<U>>,
  username: string,
  secret: string,
  filename: string | undefined,
) {
  const uri = _generateSecretURL(options, username, secret)
  return _generateQR(uri, filename) as Promise<never>
}

/** @hidden */
export function _generateSecretURL<U>(
  options: Required<Pick<AllOptions<U>, 'issuer' | 'algorithm' | 'digits' | 'period'>>,
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

/** @hidden */
export function _verifyToken<U>(
  options: Required<AllOptions<U>>,
  secret: string,
  reqToken: string,
) {
  const genToken = _totp(secret, options)
  return genToken === reqToken
}

/** @hidden */
export async function _verifyUser<U>(
  options: Required<AllOptions<U>>,
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

/** @hidden */
export function _generateSecret(): string {
  return encode(crypto.randomBytes(32)).slice(0, 32)
}
