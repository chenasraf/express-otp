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
})

app.use('/generate', totp.createToken())

app.use('/token/uri', totp.generateTokenURL())

app.use('/token/qr', totp.generateTokenQR())

app.use(totp.authenticate())

app.use('/verify', (req, res) => {
  res.setHeader('Content-Type', 'text/plain')

  if (!req.user) {
    res.send('Not logged in')
    res.status(401)
    return
  }

  res.send('Logged in as user ' + req.user.id)
  res.status(200)
})

app.listen(3000, () => {
  console.log('Server is running on port 3000')
})
