/**
 * The reason for an OTP error.
 *
 * - `no_user` - No user was found for the request.
 * - `no_token` - No token was found in the request.
 * - `invalid_token` - The token was malformed or did not match the expected token.
 */
export type OTPErrorReason = 'invalid_token' | 'no_token' | 'no_user'

/**
 * The error thrown when OTP verification fails.
 */
export class OTPError {
  /**
   * The reason for the error.
   * @param type The type of error.
   */
  constructor(public type: OTPErrorReason) {}

  /**
   * The error message.
   */
  public get message(): string {
    switch (this.type) {
      case 'invalid_token':
        return 'Invalid token'
      case 'no_token':
        return 'No token provided'
      case 'no_user':
        return 'No user found'
      default:
        return `Unknown error: ${this.type}`
    }
  }
}
