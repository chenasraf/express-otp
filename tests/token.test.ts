import { Request } from 'express'
import { _generateSecret, _generateSecretURL, _verifyToken, _verifyUser } from '../src/token'
import { AllOptions, defaultOptions } from '../src/types'
import _totp from 'totp-generator'

const _defaultOptions: Required<AllOptions<unknown>> = {
  ...defaultOptions,
  passportOptions: { tokenFormURL: '/', successRedirect: '/' },
  issuer: 'issuer',
  getUser: undefined as never,
}

describe('generateSecretURL', () => {
  test('generates normal options', () => {
    const secret = _generateSecret()
    const options: Required<AllOptions<unknown>> = {
      ..._defaultOptions,
      getUser: () => ({
        user: { username: 'username' },
        secret: secret,
        username: 'username',
      }),
    }
    expect(_generateSecretURL(options, 'username', secret)).toBe(
      `otpauth://issuer:username@totp/?issuer=issuer&account=username&secret=${secret}`,
    )
  })

  test('appends non-default options', () => {
    const secret = _generateSecret()
    const options: Required<AllOptions<unknown>> = {
      ..._defaultOptions,
      getUser: () => ({
        user: { username: 'username' },
        secret: secret,
        username: 'username',
      }),
      algorithm: 'SHA-256',
      digits: 8,
    }
    expect(_generateSecretURL(options, 'username', secret)).toBe(
      `otpauth://issuer:username@totp/?issuer=issuer&account=username&secret=${secret}&algorithm=SHA-256&digits=8`,
    )
  })
})

describe('generateSecret', () => {
  test('length is 32', () => {
    const secret = _generateSecret()
    expect(secret).toHaveLength(32)
  })

  test('contains only valid chars', () => {
    const secret = _generateSecret()
    expect(secret).toMatch(/^[A-Z2-7=]+$/)
  })
})

describe('verifyToken', () => {
  test('verifies correct token', () => {
    const secret = _generateSecret()
    const token = _totp(secret, _defaultOptions)
    const options: Required<AllOptions<unknown>> = {
      ..._defaultOptions,
      getUser: () => ({
        user: { username: 'username' },
        secret: secret,
        username: 'username',
      }),
    }
    expect(_verifyToken(options, secret, token)).toBeTruthy()
  })

  test('fails incorrect token', () => {
    const secret = _generateSecret()
    // const token = _totp(secret, defaultOptions)
    const options: Required<AllOptions<unknown>> = {
      ..._defaultOptions,
      getUser: () => ({
        user: { username: 'username' },
        secret: secret,
        username: 'username',
      }),
    }
    expect(_verifyToken(options, secret, '12345')).not.toBeTruthy()
  })
})

describe('verifyUser', () => {
  test('verifies correct user', async () => {
    const secret = _generateSecret()
    const token = _totp(secret, _defaultOptions)
    const userData = {
      user: { username: 'username' },
      secret: secret,
      username: 'username',
    }

    const options: Required<AllOptions<unknown>> = {
      ..._defaultOptions,
      getUser: () => userData,
    }
    expect(
      await _verifyUser(
        options,
        {
          query: {
            token: token,
          },
        } as unknown as Request,
        userData,
      ),
    ).toEqual(userData.user)
  })

  test('fails incorrect secret', async () => {
    const secret = _generateSecret()
    const token = _totp(secret, _defaultOptions)
    const userData = {
      user: { username: 'username' },
      secret: secret,
      username: 'username',
    }

    const options: Required<AllOptions<unknown>> = {
      ..._defaultOptions,
      getUser: () => userData,
    }
    expect(
      await _verifyUser(
        options,
        {
          query: {
            token: token,
          },
        } as unknown as Request,
        { ...userData, secret: _generateSecret() },
      ),
    ).toBeUndefined()
  })

  test('fails incorrect token', async () => {
    const secret = _generateSecret()
    const userData = {
      user: { username: 'username' },
      secret: secret,
      username: 'username',
    }

    const options: Required<AllOptions<unknown>> = {
      ..._defaultOptions,
      getUser: () => userData,
    }
    expect(
      await _verifyUser(
        options,
        {
          query: {
            token: '123456',
          },
        } as unknown as Request,
        userData,
      ),
    ).toBeUndefined()
  })
})
