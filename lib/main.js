const path   = require('path')
const util   = require('util')
const os     = require('os')
const fs     = require('fs-extra')
const tar    = require('tar')
const uglify = require('uglify-js')

const {spawnSync} = require('child_process')
const {PassThrough, Transform} = require('stream')
const {ignoreError, cat, getYode} = require('./util')

const checkLicense = util.promisify(require('license-checker-rseidelsohn').init)

const filterList = [
  'build',
  'build/*',
  'node_modules/fetch-yode',
  'node_modules/fetch-yode/**/*',
  'node_modules/.bin/yode',
  'node_modules/.bin/yode.exe',
]

const stockList = [
  'node_modules/@types',
  'node_modules/@types/**',
  '**/*.md',
  '**/*.ts',
  '**/*.map',
  '**/*.bak',
  '**/docs/**',
  '**/support/**',
  '**/test/**',
  '**/tests/**',
  '**/coverage/**',
  '**/examples/**',
  '**/.github/**',
  '**/.vscode/**',
  '**/.travis.yml',
  '**/.npmignore',
  '**/.editorconfig',
  '**/.jscs.json',
  '**/.jshintrc',
  '**/.nvmrc',
  '**/.eslintrc',
  '**/.eslintrc.json',
  '**/.eslintignore',
  '**/.uglifyjsrc.json',
  '**/.DS_Store',
  '**/tslint.json',
  '**/tsconfig.json',
  '**/Gruntfile.js',
  '**/bower.json',
  '**/package-lock.json',
  '**/badges.html',
  '**/test.html',
  '**/Makefile',
  '**/LICENSE',
  '**/License',
  '**/license',
  '**/TODO',
]

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
    const pack = spawnSync('npm', ['pack'], {shell: true, cwd: appDir}).output[1]
    const tarball = path.join(appDir, pack.toString().trim())
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
    const ret = spawnSync('npm', ['install', '--production'], {shell: true, cwd: freshDir, env})
    if (ret.status !== 0)
      throw Error(`Failed to install app: \n${ret.stderr}`)
  } catch(e) {
    await ignoreError(fs.remove(immediateDir))
    throw e
  }
  return freshDir
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

// Collect licenses.
async function writeLicenseFile(outputDir, freshDir) {
  let license = ''
  const data = await checkLicense({start: freshDir})
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

// Sign all binaries in the res dir.
async function signAllBinaries(dir, {top, promises} = {top: true, promises: []}) {
  const files = await fs.readdir(dir)
  for (const f of files) {
    const p = path.join(dir, f)
    const stats = await fs.stat(p)
    if (stats.isDirectory())
      promises.push(signAllBinaries(p, {top: false, promises}))
    else if (stats.isFile() && f.endsWith('.node'))
      promises.push(require('./mac').adHocSign(p))
  }
  if (top)
    await Promise.all(promises)
}

// Package the app with Yode.
async function packageApp(outputDir, appDir, options, platform, arch) {
  const appInfo = getAppInfo(await fs.readJson(path.join(appDir, 'package.json')))
  Object.assign(options, appInfo)
  let target = path.join(outputDir, platform === 'win32' ? `${appInfo.name}.exe` : appInfo.name)
  const freshDir = await installApp(appDir, platform, arch)
  const intermediate = path.resolve(outputDir, 'app.ear')
  const cwd = process.cwd()
  try {
    const yodePath = getYode(freshDir).path
    const asarOpts = {
      // Let glob search "**/*' under freshDir, instead of passing freshDir to
      // asar directly. In this way our filters can work on the source root dir.
      pattern: '**/*',
      transform: options.minify ? transform.bind(this, freshDir) : null,
      unpack: options.unpack,
      globOptions: {
        cwd: freshDir,
        noDir: true,
        ignore: filterList.concat(stockList),
      },
    }
    process.chdir(freshDir)
    await require('asar').createPackageWithOptions('', intermediate, asarOpts)
    process.chdir(cwd)
    await appendMeta(intermediate)
    await fs.ensureDir(outputDir)
    if (platform === 'win32')
      await require('./win').modifyExe(yodePath, appInfo, appDir)
    const canBeSigned = await replaceOffsetPlaceholder(yodePath)
    await cat(target, yodePath, intermediate)
    if (canBeSigned && platform === 'darwin') {
      await require('./mac').extendStringTableSize(target)
      await require('./mac').adHocSign(target)
    }
    await fs.chmod(target, 0o755)
    await writeLicenseFile(outputDir, freshDir)
    const resDir = path.join(outputDir, 'res')
    await ignoreError(fs.remove(resDir))
    await ignoreError(fs.rename(`${intermediate}.unpacked`, resDir))
    if (canBeSigned && platform === 'darwin')
      await signAllBinaries(resDir)
  } finally {
    // Cleanup.
    process.cwd(cwd)
    await ignoreError(fs.remove(freshDir))
    await ignoreError(fs.remove(intermediate))
    await ignoreError(fs.remove(`${intermediate}.unpacked`))
  }
  if (platform === 'darwin')
    target = await require('./mac').createBundle(appInfo, appDir, outputDir, target)
  return target
}

module.exports = {packageApp}
