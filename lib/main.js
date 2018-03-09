const path = require('path')
const util = require('util')
const fs = require('fs-extra')
const axios = require('axios')

const extract = util.promisify(require('extract-zip'))

const URL_PRFIX = 'https://github.com/yue/yode/releases/download'

function streamPromise(stream) {
  return new Promise((resolve, reject) => {
    stream.on('end', () => {
      resolve('end')
    })
    stream.on('finish', () => {
      resolve('finish')
    })
    stream.on('error', (error) => {
      reject(error)
    })
  })
}

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
    await fs.remove(targetDir).catch(() => {})
    throw e
  }
  return yodePath
}

async function main() {
  console.log(await downloadYode('v0.2.0', 'darwin', 'x64', '/tmp/yode'))
}

main()
