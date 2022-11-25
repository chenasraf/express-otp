import crypto from 'node:crypto'
import { encode } from 'hi-base32'
import QR from 'qrcode'

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
