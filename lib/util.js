const fs   = require('fs')
const path = require('path')
const util = require('util')

// Find out the fetch-yode module.
function getYode(appDir) {
  try {
    return require(path.join(appDir, 'node_modules', 'fetch-yode'))
  } catch {
    throw new Error('The "fetch-yode" module must be a dependency of the app')
  }
}

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

module.exports = {getYode, ignoreError, cat, streamPromise}
