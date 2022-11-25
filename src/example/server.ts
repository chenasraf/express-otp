import express from 'express'
import otipi from '..'
import dotenv from 'dotenv'

dotenv.config()

const app = express()

const sampleUser = { id: 1, username: process.env.USER_NAME!, secret: process.env.USER_SECRET! }

const totp = otipi<typeof sampleUser>({
  issuer: 'my-issuer',
  getUser: (req) => {
    const user = [sampleUser].find((x) => x.username === req.query.username)
    if (!user) {
      return undefined
    }
    return { user, secret: user.secret, username: user.username }
  },
  getToken: (req) => req.headers['X-OTP-Token'] as string,
})

app.use('/generate', (req, res) => res.status(200).send(totp.generateNewSecret()))
app.use('/token/uri', async (req, res) =>
  res
    .status(200)
    .setHeader('Content-Type', 'text/plain')
    .send(await totp.generateSecretURL(sampleUser.username, sampleUser.secret)),
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

app.use(totp.authenticate())

app.use('/verify', (req, res) => {
  res.setHeader('Content-Type', 'text/plain')

  if (!req.user) {
    res.send('Not logged in')
    res.status(401)
    return
  }

  res.send('Logged in as user ' + JSON.stringify(req.user))
  res.status(200)
})

app.listen(3000, () => {
  console.log('Server is running on port 3000')
})
