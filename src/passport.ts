import { Request } from 'express'
import { Strategy } from 'passport-strategy'
import { AllOptions, defaultOptions } from './types'
import { _verifyToken } from './token'

/**
 * Strategy for Passport.js
 */
export class PassportOTPStrategy<T> extends Strategy {
  name: string
  private _options: Required<AllOptions<T>>

  constructor(options: Required<AllOptions<T>>) {
    super()
    this.name = 'otp'
    if (!options.passportOptions) {
      throw new Error('Passport options are required')
    }
    this._options = { ...defaultOptions, ...options }
  }

  async authenticate(req: Request, options?: Partial<AllOptions<T>>): Promise<void> {
    try {
      const _options = { ...this._options, options }

      const token = await _options.getToken(req)
      const userData = await _options.getUser(req)

      if (!userData) {
        return this.fail(new Error('User not found'), 401)
      }

      if (!token) {
        if (this._options.tokenForm && this._options.passportOptions?.tokenFormURL) {
          return this.redirect(this._options.passportOptions.tokenFormURL)
        }

        return this.fail(new Error('Token not found'), 401)
      }

      const { user, secret } = userData
      if (_verifyToken(_options, secret, token)) {
        this.success(user)
      } else {
        this.fail(new Error('Invalid token'), 401)
      }
    } catch (err) {
      if (err instanceof Error) {
        this.error(err)
      } else {
        this.error(new Error(`Unknown error: ${err}`))
      }
    }
  }
}

export interface PassportOTPStrategyOptions {
  successRedirect: string
  tokenFormURL: string
}
