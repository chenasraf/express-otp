import { NextFunction, Request, Response } from 'express'
import { OTPError } from './error'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    export interface Request {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      user?: any
    }
  }
}

/** Options for TOTP generation */
export interface TotpOptions {
  /** The issuer for your app (required) */
  issuer: string
  /** The time it takes for a new token to generate, in seconds. Defaults to 30 */
  period?: number | undefined
  /**
   * The desired SHA variant (SHA-1, SHA-224, SHA-256, SHA-384, SHA-512,
   * SHA3-224, SHA3-256, SHA3-384, SHA3-512, SHAKE128, or SHAKE256).
   *
   * Default is `SHA-1`.
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
  /** Amount of token digits to use. Defaults to 6 */
  digits?: number | undefined
  /** The epoch time. Defaults to 0 (unix epoch) */
  timestamp?: number | undefined
}

export interface UserData<U> {
  /** The user object that will get injected into further requests. */
  user: U
  /** The secret key of the user, used for generating a comparison key. */
  secret: string
  /** The username used for generating the token URL/QR. */
  username: string
}

/**
 * A promise of `T` or a value of `T`.
 */
export type PromiseOrValue<T> = T | Promise<T>

/** Options for API middleware flow */
export interface TotpApiOptions<U> {
  /**
   * If the return value is not `undefined`, it uses this function to verify and then inject the correct user into further
   * requests in a middleware (usually before request processing).
   *
   * This is where you would decide which users this request belongs to, via whatever method you want - going into DB,
   * checking headers, etc.
   *
   * - The `user` property of the return value will be injected into further requests.
   * - The `secret` property of the return value will be used to generate a comparison key.
   * - The `username` property of the return value will be used to generate the token URL/QR.
   *
   * Returning `undefined` will cause the request to continue as normal, without any user injected.
   *
   * It is up to you to return an error in the actual request if necessary.
   *
   * @param {Request} req The request object.
   */
  getUser(req: Request): PromiseOrValue<UserData<U> | undefined>

  /**
   * This function should return the token from the request (e.g. from a header, or from a query parameter).
   *
   * @param {Request} req The request object.
   * @returns {string | undefined} The token from the request, or `undefined` if it doesn't exist.
   */
  getToken?(req: Request): PromiseOrValue<string | undefined>

  /**
   * If this function is provided, it will be used to respond to the user with an error when OTP verification fails.
   * The response ends after this function is called.
   *
   * @param req The request object.
   * @param res The response object.
   * @param next The next function.
   */
  errorResponse?(req: Request, res: Response, next: NextFunction, reason: OTPError): void

  /**
   * Setting this to `true` will cause the middleware to respond with a form to accept user input for the token if it
   * is missing from the authorized request.
   *
   * Setting this to a function will use the function as the middleware to handle the request. You will be in charge of
   * redirecting or otherwise handling the request in this case.
   *
   * This only works for GET requests, as it will redirect to the same URL with the token as a query parameter.
   */
  tokenForm?: ((req: Request, res: Response) => PromiseOrValue<void>) | boolean

  /**
   * Options for generating the token form.
   */
  tokenFormOptions?: Partial<TokenFormOptions>
}

/** Combination of {@link TotpOptions} and {@link TotpApiOptions}. */
export type AllOptions<U> = TotpOptions & TotpApiOptions<U>

/**
 * Options for generating the token form.
 */
export interface TokenFormOptions {
  /** A mapping of text labels to use in the form.*/
  texts: Partial<Record<'title' | 'promptTitle' | 'promptDescription' | 'submitButton', string>>
  /** Custom CSS to add to the page. Is appended at the end of <head>. */
  css: string
  /** Custom JS to add to the page. Is appended at the end of <body>. */
  js: string
  /** Custom HTML to prepend before the title, inside the <main> element. */
  prependHtml: string
  /** Custom HTML to append after the form, inside the <main> element. */
  appendHtml: string
}

/**
 * Options for the middleware. These override the options passed to `totp()`.
 */
export type AuthOptions<U> = Partial<TotpApiOptions<U>>

/**
 * This object contains the `authenticate()` function which is the main middleware, as well as additional functions for
 * generating tokens and URLs.
 */
export interface TotpMiddlewares<U> {
  /**
   * Middleware for authenticating a user, using their secret and the token provided in the request.
   *
   * @param {AuthOptions<U>} options Options for the middleware.
   *
   * @see {@link TotpApiOptions.getUser | TotpApiOptions.getUser} to control which user gets used for comparing the token to and later injected into
   * further requests.
   *
   * @see {@link TotpApiOptions.getToken | TotpApiOptions.getToken} to control how the token is fetched in the request (query, headers, etc).
   */
  authenticate(options?: AuthOptions<U>): (req: Request, res: Response, next: () => void) => Promise<void>

  /**
   * Function for generating a secret URL for a user from a given `secret` and `username`.
   *
   * @param {string} username The username to use for generating the URL.
   * @param {string} secret The secret to use for generating the URL.
   *
   * @returns {string} The URL for the user.
   */
  generateSecretURL(username: string, secret: string): string

  /**
   * Function for generating a QR code for a user from a given `secret` and `username`.
   *
   * This returns a PNG image as a data URL.
   *
   * @param {string} username The username to use for generating the URL.
   * @param {string} secret The secret to use for generating the URL.
   *
   * @returns {Promise<string>} The QR code as a data URL.
   */
  generateSecretQR(username: string, secret: string): Promise<string>

  /**
   * Function for generating a QR code for a user from a given `secret` and `username`.
   *
   * This writes the QR code directly to a file, which you can later use to serve to the user.
   *
   * @param {string} username The username to use for generating the URL.
   * @param {string} secret The secret to use for generating the URL.
   * @param {string} filename The path of the file to write the QR image to.
   */
  generateSecretQR(username: string, secret: string, filename: string): Promise<void>

  /**
   * Function for generating a QR code for a user from a given `secret` and `username`.
   *
   * - If `filename` is provided, this writes the QR code directly to that path, which you can later use to serve to the
   * user.
   * - If `filename` is omitted (or blank), this returns a PNG image as a data URL.
   *
   * @param {string} username The username to use for generating the URL.
   * @param {string} secret The secret to use for generating the URL.
   * @param {string} filename If provided, will use as path of the file to write the QR image to.
   */
  generateSecretQR(username: string, secret: string, filename?: string): Promise<string | void>

  /**
   * Generates a random, 32-byte secret key. You can attach this to your user object or DB however you want.
   */
  generateNewSecret(): string

  /**
   * Verifies a given token against a given secret. If the provided token is equal to the generated token for given
   * secret, it returns `true`. Otherwise, it returns `false`.
   *
   * @param secret The secret key of the user.
   * @param token The request token to verify against.
   *
   * @returns {boolean} `true` if the token is valid, `false` otherwise.
   */
  verifyToken(secret: string, token: string): boolean

  /**
   * Returns the user, only if the token is valid. Otherwise, it returns `undefined`.
   *
   * @param req The request object.
   * @returns {Promise<U | undefined>} The user, or `undefined` if the token is invalid.
   */
  verifyUser(req: Request): Promise<U | undefined>
}

/**
 * The default options for the middleware.
 */
export const defaultOptions: Omit<Required<AllOptions<unknown>>, 'issuer' | 'getUser'> = {
  digits: 6,
  period: 30,
  algorithm: 'SHA-1',
  getToken: (req) => req.query.token as string,
  tokenFormOptions: {},
  errorResponse: undefined as never,
  tokenForm: false,
  timestamp: undefined as never,
}
