import fs from 'fs/promises'
import path from 'path'

async function main() {
  console.log('Copying package.json')
  const json = JSON.parse(await fs.readFile('package.json', 'utf-8'))
  delete json.devDependencies
  delete json.scripts
  await fs.writeFile(path.join('build', 'package.json'), JSON.stringify(json, null, 2))

  //
  const viewDir = path.join('build', 'views')
  const viewPath = path.join('src', 'views', 'get_token.html')
  const viewOutPath = path.join('build', 'views', 'get_token.html')
  await fs.mkdir(viewDir, { recursive: true })
  console.log(`Copying ${viewPath}`)

  const data = await fs.readFile(viewPath, 'utf-8')
  await fs.writeFile(viewOutPath, data)

  console.log('Copying README.md')
  await copyFile('README.md')

  console.log('Copying LICENSE')
  await copyFile('LICENSE')

  console.log('Done')
}

async function copyFile(filename: string) {
  const data = await fs.readFile(filename, 'utf-8')
  await fs.writeFile(path.join('build', filename), data)
}

main()
