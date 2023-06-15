const path   = require('path')
const util   = require('util')
const os     = require('os')
const asar   = require('@electron/asar')
const fs     = require('fs-extra')
const spawn  = require('await-spawn')
const tar    = require('tar')
const uglify = require('uglify-js')

const {PassThrough, Transform} = require('stream')
const {fixedFilterList, stockFilterList} = require('./filters')
const {ignoreError, cat, getYode} = require('./util')

const checkLicense = util.promisify(require('license-checker-rseidelsohn').init)

// Minimize js file.
function transform(rootDir, p) {
  if (!p.endsWith('.js'))
    return new PassThrough()
  let data = ''
  return new Transform({
    transform(chunk, encoding, callback) {
      data += chunk
      callback(null)
    },
    flush(callback) {
      const result = uglify.minify(data, {parse: {bare_returns: true}})
      if (result.error) {
        const rp = path.relative(rootDir, p)
        const message = `${result.error.message} at line ${result.error.line} col ${result.error.col}`
        console.error(`Failed to minify ${rp}:`, message)
        callback(null, data)
      } else {
        callback(null, result.code)
      }
    }
  })
}

// Parse the packageJson and generate app information.
function getAppInfo(packageJson) {
  const appInfo = {
    name: packageJson.name,
    version: packageJson.version,
    description: packageJson.description,
    appId: `com.${packageJson.name}.${packageJson.name}`,
    productName: packageJson.build.productName
  }
  if (packageJson.build)
    Object.assign(appInfo, packageJson.build)
  if (!appInfo.copyright)
    appInfo.copyright = `Copyright © ${(new Date()).getYear()} ${appInfo.productName}`
  return appInfo
}

// Copy the app into a dir and install production dependencies.
async function installApp(appDir, platform, arch) {
  const immediateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yacakge-'))
  const freshDir = path.join(immediateDir, 'package')
  try {
    // cd appDir && npm pack
    const pack = await spawn('npm', ['pack'], {shell: true, cwd: appDir})
    const tarball = path.join(appDir, pack.toString().trim().split('\n').pop())
    try {
      // cd immediateDir && tar xf tarball
      await tar.x({file: tarball, cwd: immediateDir})
    } finally {
      await ignoreError(fs.remove(tarball))
    }
    // cd freshDir && npm install --production
    const env = Object.create(process.env)
    env.npm_config_platform = platform
    env.npm_config_arch = arch
    try {
      await spawn('npm', ['install', '--production'], {shell: true, cwd: freshDir, env})
    } catch (error) {
      throw Error(`Failed to install app: \n${error.stderr}`)
    }
  } catch (error) {
    console.error('Package dir left for debug:', freshDir)
    throw error
  }
  return freshDir
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

// Creaet asar archive.
async function createAsarArchive(appDir, outputDir, target, appInfo) {
  const asarOpts = {
    // Let glob search "**/*' under appDir, instead of passing appDir to asar
    // directly. In this way our filters can work on the source root dir.
    pattern: '**/*',
    transform: appInfo.minify ? transform.bind(this, appDir) : null,
    unpack: appInfo.unpack,
    unpackDir: appInfo.unpackDir,
    globOptions: {
      cwd: appDir,
      noDir: true,
      ignore: fixedFilterList.concat(stockFilterList),
    },
  }
  // Do not include outputDir in the archive.
  let relativeOutputDir = path.isAbsolute(outputDir) ? path.relative(appDir, outputDir)
                                                     : outputDir
  asarOpts.globOptions.ignore.push(outputDir)
  asarOpts.globOptions.ignore.push(outputDir + '/*')
  if (appInfo.ignore)
    asarOpts.globOptions.ignore.push(...appInfo.ignore);
  // Run asar under appDir to work around buggy glob behavior.
  const cwd = process.cwd()
  try {
    process.chdir(appDir)
    await asar.createPackageWithOptions('', target, asarOpts)
  } finally {
    process.chdir(cwd)
  }
  await appendMeta(target)
}

// Write the size of binary into binary.
async function replaceOffsetPlaceholder(target) {
  const mark = '/* REPLACE_WITH_OFFSET */'
  const data = await fs.readFile(target)
  const pos = data.indexOf(Buffer.from(mark))
  if (pos <= 0)
    return false
  const stat = await fs.stat(target)
  const replace = `, ${stat.size}`.padEnd(mark.length, ' ')
  data.write(replace, pos)
  await fs.writeFile(target, data)
  return true
}

// Collect licenses.
async function writeLicenseFile(outputDir, appDir) {
  let license = ''
  const data = await checkLicense({start: appDir})
  for (const name in data) {
    const info = data[name]
    if (!info.licenseFile)
      continue
    license += name + '\n'
    if (info.publisher)
      license += info.publisher + '\n'
    if (info.email)
      license += info.email + '\n'
    if (info.url)
      license += info.url + '\n'
    const content = await fs.readFile(info.licenseFile)
    license += '\n' + content.toString().replace(/\r\n/g, '\n')
    license += '\n' + '-'.repeat(70) + '\n\n'
  }
  await fs.writeFile(path.join(outputDir, 'LICENSE'), license)
}

async function packageApp(outputDir, appDir, options, platform, arch) {
  const appInfo = getAppInfo(await fs.readJson(path.join(appDir, 'package.json')))
  Object.assign(appInfo, options)
  await fs.emptyDir(outputDir)
  let target = path.join(outputDir, platform === 'win32' ? `${appInfo.name}.exe` : appInfo.name)
  const intermediateAsar = path.resolve(outputDir, 'app.ear')
  const srcYodePath = getYode(appDir).path
  const yodePath = path.resolve(outputDir, path.basename(srcYodePath))
  try {
    await Promise.all([
      createAsarArchive(appDir, outputDir, intermediateAsar, appInfo),
      fs.copy(srcYodePath, yodePath),
    ])
    if (platform === 'darwin')  // remove existing signature
      await spawn('codesign', ['--remove-signature', yodePath])
    else if (platform === 'win32')  // add icon and exe info
      await require('./win').modifyExe(yodePath, appInfo, appDir)
    // Modify the offset placeholder inside binary.
    await replaceOffsetPlaceholder(yodePath)
    // Append asar file to the end of yode binary.
    await cat(target, yodePath, intermediateAsar)
    // Patch the executable to make it signable.
    if (platform === 'darwin')
      await require('./mac').extendStringTableSize(target)
    await Promise.all([
      fs.chmod(target, 0o755),
      writeLicenseFile(outputDir, appDir),
      (async () => {
        const resDir = path.join(outputDir, 'res')
        await ignoreError(fs.remove(resDir))
        await ignoreError(fs.rename(`${intermediateAsar}.unpacked`, resDir))
      })(),
    ])
  } finally {
    await ignoreError([
      fs.remove(yodePath),
      fs.remove(intermediateAsar),
      fs.remove(`${intermediateAsar}.unpacked`),
    ])
  }
  if (platform === 'darwin') {
    target = await require('./mac').createBundle(appInfo, appDir, outputDir, target)
    await require('./mac').codeSign(appInfo, target)
  }
  return target
}

async function packageCleanApp(outputDir, appDir, options, platform, arch) {
  const freshDir = await installApp(appDir, platform, arch)
  try {
    return await packageApp(outputDir, freshDir, options, platform, arch)
  } finally {
    await ignoreError(fs.remove(freshDir))
  }
}

module.exports = {packageApp, packageCleanApp}
