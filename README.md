# express-otp

<h2 align="center">

[GitHub](https://github.com/chenasraf/express-otp) | [Documentation](https://casraf.dev/express-otp)
| [NPM](https://npmjs.com/package/express-otp) | [casraf.dev](https://casraf.dev)

</h2>

Incredibly simple TOTP authentication for your Node.JS/Express backend.

Use it for authenticating either select admins to perform sensitive actions, or use it as the main
auth mechanism for your app.

Set-up is incredibly easy!

## Getting started

See [src/example/server.ts](src/example/server.ts) for a fully working example usage.

### Initialize

First, use the `otp` function to generate middleware and functions for your use:

```typescript
import otp from 'express-otp'

const totp = otp({
  // Any identifier that is for your app
  issuer: 'my-issuer',
  // This should return user information if a request contains a valid user
  // attempt (such as username or email)
  getUser: async (req) => {
    const user = await db.users.findOne({ username: req.query.username })
    if (!user) {
      return undefined
    }
    return { user: user.details, secret: user.secret, username: user.username }
  },
  // By default, the token is fetched using `req.query.token`. You can change
  // that by providing a `getToken` option:
  getToken: (req) => req.headers['X-OTP-Token'] as string,
})
```

### Generate a user secret

Tokens must be valid 32-bit strings (characters `A-Z` and `2-7` and `=`).

You can supply your own tokens, or generate one using `generateNewSecret()`.

```typescript
const token = totp.generateNewSecret()
console.log(token) // example: 4XLM2M7UTOLK6JYUX7BR2KB5USM7HM6J
```

#### Generate a URL/QR

You can generate an OATH URI or a QR code containing that URI, for your users to scan and be able to
use in their authenticator apps.

```typescript
// generate URL
const uri = totp.generateSecretURL(username, secret)

// generate QR data URL (for use in `<img src="...">`)
const qrDataURL = await totp.generateSecretQR(username, secret)

// write QR image directly to file - add 3rd argument
await totp.generateSecretQR(username, secret, '/path/to/qr.png')
```

### Authenticate a user

To lock any endpoint behind authentication, use the provided `authenticate()` middleware. If the
user provided the token by your specified method, the user is injected into the request. If the
`req` object contains a `user`, that means your user is authenticated!

Further requests will still need to be validated with a correct token. The authentication state will
**not be saved in memory** between sessions - that is up to you to implement (if necessary).

```typescript
app.get('/user/me', totp.authenticate(), (req, res) => {
  if (!req.user) {
    res.status(401).json('Unauthorized')
    return
  }

  res.status(200).json(req.user)
})
```

## Contributing

I am developing this package on my free time, so any support, whether code, issues, or just stars is
very helpful to sustaining its life. If you are feeling incredibly generous and would like to donate
just a small amount to help sustain this project, I would be very very thankful!

<a href='https://ko-fi.com/casraf' target='_blank'>
  <img height='36' style='border:0px;height:36px;'
    src='https://cdn.ko-fi.com/cdn/kofi1.png?v=3'
    alt='Buy Me a Coffee at ko-fi.com' />
</a>

I welcome any issues or pull requests on GitHub. If you find a bug, or would like a new feature,
don't hesitate to open an appropriate issue and I will do my best to reply promptly.

If you are a developer and want to contribute code, here are some starting tips:

1. Fork this repository
2. Run `yarn install`
3. Run `yarn start` to start file watch mode
4. Make any changes you would like
5. Create tests for your changes
6. Update the relevant documentation (readme, code comments, type comments)
7. Create a PR on upstream
