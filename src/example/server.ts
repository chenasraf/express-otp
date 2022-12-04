import express from 'express'
import otp from '..'
import dotenv from 'dotenv'
import passport from 'passport'

dotenv.config()

const app = express()

const sampleUser = {
  id: 1,
  username: process.env.USER_NAME!,
  secret: process.env.USER_SECRET!,
}

const totp = otp<typeof sampleUser>({
  issuer: 'my-issuer',
  getUser(req) {
    const user = [sampleUser].find((x) => x.username === req.query.username)
    if (!user) {
      return undefined
    }
    return { user, secret: user.secret, username: user.username }
  },
  errorResponse(req, res, next, error) {
    res.send(error.message)
    res.status(401)
  },
  passportOptions: {
    successRedirect: '/passport-success',
    tokenFormURL: '/token',
  },
})

app.use('/generate', (req, res) => res.status(200).send(totp.generateNewSecret()))

app.use('/token/uri', async (req, res) =>
  res
    .status(200)
    .setHeader('Content-Type', 'text/plain')
    .send(totp.generateSecretURL(sampleUser.username, sampleUser.secret)),
)

app.use('/token/qr', async (req, res) =>
  res
    .status(200)
    .setHeader('Content-Type', 'text/html')
    .send(
      '<img src="' +
        (await totp.generateSecretQR(sampleUser.username, sampleUser.secret)) +
        '" style="width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated;" />',
    ),
)

app.use(
  '/verify',
  totp.authenticate({
    tokenForm: true,
  }),
  (req, res) => {
    res.setHeader('Content-Type', 'text/plain')
    res.send('Logged in as user ' + JSON.stringify(req.user))
    res.status(200)
  },
)

passport.use(totp.passport())

app.use('/verify-passport', passport.authenticate('otp'), (req, res) => {
  res.setHeader('Content-Type', 'text/plain')
  res.send('Logged in as user ' + JSON.stringify(req.user))
  res.status(200)
})

app.listen(3000, () => {
  console.log('Server is running on port 3000')
})
