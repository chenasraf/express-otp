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

  // Use this option to immediately respond with an error when a token is
  // missing/invalid. If this is omitted, the next route/middleware will fire
  // normally, but without `req.user` injected. Providing this function ends
  // the response if it's fired.
  errorResponse(req, res, next, error) {
    res.send(error.message)
    res.status(401)
  },

  // Use `true` for default OTP form, or respond with your own form in a function.
  // The default form will redirect to the same URL with the `token` URL
  // parameter added. To modify this behavior to use another token method,
  // you will have to supply your own form.
  tokenForm: true,
  tokenForm(req, res) {
    res.render(myFormPage)
  },
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
user provided the token by your specified method, the user is injected into the request.

If you specified `tokenForm` as true or your own function, a missing token will trigger that form to
be responded to the user.

Otherwise, an error will be chained to the next middleware. You can make it respond immediately with
an error by using `errorResponse` option.

You can pass options to the `authenticate()` method to override options from the top-level call, for
example setting a custom error response, or token form page.

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

#### Manual authentication

If you want to manually check the OTP in your own middleware, you can use the `verifyUser` and
`verifyToken` methods. You will need to inject the user yourself in that case. However, you would
get more fine-tuned control over the response timing & structure.

```typescript
if ('token' in req.query) {
  console.log('Token is valid:', totp.verifyToken(userSecret, req.token))
  const user = await totp.verifyUser(req)
  if (!user) {
    next(new Error('Invalid OTP token'))
    return
  }
  req.user = user
  next(null)
  return
}
```

### Customizing error/token form

You can supply functions that will act as middleware when getting a request with no token, or an
invalid token or a missing user.

When either of theses are specified, they are used instead of the default behaviors.

```typescript
const totp = otp({
  // custom token form
  tokenForm(req, res) {
    res.status(200).render(myTokenForm)
  },
  // custom error page
  errorResponse(req, res, next, error) {
    res.status(400).json({
      code: error.type,
      message: error.message,
    })
  },
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
