const path = require('path')
const util = require('util')
const fs = require('fs-extra')
const axios = require('axios')
const uglifyjs = require('uglify-es')
const {PassThrough, Transform} = require('stream')
const {streamPromise, ignoreError, cat} = require('./util')

const createPackage = util.promisify(require('asar').createPackageWithOptions)
const extract = util.promisify(require('extract-zip'))

// Where to download Yode.
const URL_PRFIX = 'https://github.com/yue/yode/releases/download'

// Minimize js file.
function transform(p) {
  if (!p.endsWith('.js'))
    return new PassThrough()
  let data = ''
  return new Transform({
    transform(chunk, encoding, callback) {
      data += chunk
      callback(null)
    },
    flush(callback) {
      const result = uglifyjs.minify(data)
      callback(result.error, result.code)
    }
  })
}

// Download and unzip Yode into cacheDir.
async function downloadYode(version, platform, arch, cacheDir) {
  const name = `yode-${version}-${platform}-${arch}`
  const yode = platform === 'win32' ? 'yode.exe' : 'yode'
  const url = `${URL_PRFIX}/${version}/${name}.zip`
  const targetDir = path.join(cacheDir, name)
  const targetZip = path.join(targetDir, `${name}.zip`)
  const yodePath = path.join(targetDir, yode)
  if (await fs.pathExists(yodePath))
    return yodePath
  try {
    await fs.ensureDir(targetDir)
    const response = await axios.get(url, {responseType: 'stream'})
    response.data.pipe(fs.createWriteStream(targetZip))
    await streamPromise(response.data)
    await extract(targetZip, {dir: targetDir})
    await fs.remove(targetZip)
    await fs.chmod(yodePath, 0o755)
  } catch(e)  {
    await ignoreError(fs.remove(targetDir))
    throw e
  }
  return yodePath
}

// Append ASAR meta information at end of target.
async function appendMeta(target) {
  const stat = await fs.stat(target)
  const meta = Buffer.alloc(8 + 1 + 4)
  const asarSize = stat.size + meta.length
  meta.writeDoubleLE(asarSize, 0)
  meta.writeUInt8(2, 8)
  meta.write('ASAR', 9)
  await fs.appendFile(target, meta)
}

// Package the app with Yode.
async function packageApp(target, appPath, options, ...args) {
  const asarOpts = {transform, unpack: '*.node'}
  Object.assign(asarOpts, options)
  const yodePath = await downloadYode.apply(null, args)
  const intermediate = 'app.ear'
  try {
    await createPackage(appPath, intermediate, asarOpts)
    await appendMeta(intermediate)
    await fs.ensureDir(path.dirname(target))
    await cat(target, yodePath, intermediate)
    await fs.chmod(target, 0o755)
    const resDir = path.resolve(target, '..', 'res')
    await ignoreError(fs.remove(resDir))
    await ignoreError(fs.rename(`${intermediate}.unpacked`, resDir))
  } finally {
    await ignoreError(fs.remove(intermediate))
  }
  return target
}

module.exports = { downloadYode, packageApp }
