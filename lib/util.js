const fs    = require('fs-extra')
const path  = require('path')
const util  = require('util')
const axios = require('axios')
const downloadYue = require('download-yue')

// Ignore error of a Promise.
function ignoreError(promise) {
  return promise.catch(() => {})
}

// Concatenate files together.
async function cat(output, ...args) {
  const write = fs.createWriteStream(output)
  for (const f of args) {
    const read = fs.createReadStream(f)
    read.pipe(write, { end: false })
    await streamPromise(read)
  }
  await util.promisify(write.end).call(write)
}

// Get latest version of Yode.
async function getLatestYodeVersion(cacheDir, timeout = 600000) {
  const cache = path.join(cacheDir, 'yode-latest-release')

  if (await fs.pathExists(cache)) {
    try {
      const release = await fs.readJson(cache)
      if (release.time + timeout > Date.now()) {
        return release.tag_name
      }
    } catch (err) {
      // Do nothing
    }
  }

  const release = await axios.get('https://api.github.com/repos/yue/yode/releases/latest')
  await fs.ensureFile(cache)
  await fs.writeJson(cache, {tag_name: release.data.tag_name, time: Date.now()})
  return release.data.tag_name
}

// Download and unzip Yode into cacheDir.
async function downloadYode(version, platform, arch, cacheDir) {
  const name = `yode-${version}-${platform}-${arch}`
  const filename = `${name}.zip`
  const targetDir = path.join(cacheDir, name)
  const yodePath = path.join(targetDir, platform == 'win32' ? 'yode.exe' : 'yode')
  if (await fs.pathExists(yodePath))
    return yodePath
  try {
    await downloadYue('yode', version, filename, targetDir)
    await fs.chmod(yodePath, 0o755)
  } catch(e)  {
    await ignoreError(fs.remove(targetDir))
    throw e
  }
  return yodePath
}

// Turn stream into Promise.
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

module.exports = {ignoreError, cat, getLatestYodeVersion, downloadYode}
