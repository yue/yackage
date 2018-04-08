const fs   = require('fs-extra')
const util = require('util')
const path = require('path')
const yazl = require('yazl')
const glob = util.promisify(require('glob'))

const {streamPromise} = require('./util')

async function addDir(zip, dir) {
  const files = await glob(dir.replace(/\\/g, '/') + '/**', {absolute: true})
  for (const f of files) {
    const stat = await fs.stat(f)
    if (!stat.isFile())
      continue
    zip.addFile(f, path.join(path.basename(dir), path.relative(dir, f)))
  }
}

async function createZip(appDir, platform, arch, target) {
  const packageJson = await fs.readJson(path.join(appDir, 'package.json'))
  const zipName = `${packageJson.name}-v${packageJson.version}-${platform}-${arch}.zip`
  const zip = new yazl.ZipFile()
  const stream = zip.outputStream.pipe(fs.createWriteStream(zipName))

  if (platform === 'darwin') {
    await addDir(zip, target)
  } else {
    zip.addFile(target, path.basename(target))
    const resDir = path.resolve(target, '..', 'res')
    if (await fs.pathExists(resDir))
      await addDir(zip, resDir)
  }
  zip.end()

  await streamPromise(stream)
  return zipName
}

module.exports = {createZip}
