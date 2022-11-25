import express from 'express'
import totp from 'totp-generator'
import { base32secret, generateQR, generateTokenUri } from '..'

const app = express()

const sampleUser = { id: 1, username: '', secret: '' } // base32secret()

app.use('/generate', (req, res) => {
  res.send(base32secret())
  res.setHeader('Content-Type', 'text/plain')
  res.status(200)
})

app.use('/token/uri', (req, res) => {
  res.send(
    generateTokenUri({
      issuer: 'App',
      secret: sampleUser.secret,
      username: sampleUser.username,
    }),
  )
  res.setHeader('Content-Type', 'text/plain')
  res.status(200)
})

app.use('/token/qr', async (req, res) => {
  const uri = generateTokenUri({
    issuer: 'App',
    secret: sampleUser.secret,
    username: sampleUser.username,
  })
  console.log('🚀 ~ file: server.ts ~ line 33 ~ app.use ~ uri', uri)
  const qr = await generateQR(uri)
  console.log('🚀 ~ file: server.ts ~ line 35 ~ app.use ~ qr', qr)
  res.setHeader('Content-Type', 'text/html')
  res.send(`<img src="${qr}" />`)
  res.status(200)
  // res.status(200)
})

app.use((req, res, next) => {
  const { secret, token } = req.query

  if (secret && token) {
    if (secret.length !== 32 || !(secret as string).match(/^[A-Z2-7]+$/)) {
      res.status(400)
      res.send('Invalid secret')
      res.end()
      return
    }

    if (totp(sampleUser.secret, { digits: 6 }) !== token) {
      res.status(400)
      res.send('Invalid token')
      res.end()
      return
    }

    req.user = sampleUser
  }
  next()
})

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
