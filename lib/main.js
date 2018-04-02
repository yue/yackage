const path   = require('path')
const util   = require('util')
const os     = require('os')
const fs     = require('fs-extra')
const tar    = require('tar')
const axios  = require('axios')
const uglify = require('uglify-es')
const downloadYue = require('download-yue')

const {spawnSync} = require('child_process')
const {PassThrough, Transform} = require('stream')
const {streamPromise, ignoreError, cat} = require('./util')

const createPackage = util.promisify(require('asar').createPackageWithOptions)

const ignore = [
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

// Get latest version of Yode.
async function getLatestYodeVersion() {
  const release = await axios.get('https://api.github.com/repos/yue/yode/releases/latest')
  return release.data.tag_name
}

// Copy the app into a dir and install production dependencies.
async function installApp(appDir, platform, arch) {
  const immediateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yacakge-'))
  const freshDir = path.join(immediateDir, 'package')
  try {
    // cd appDir && npm pack
    const pack = spawnSync('npm', ['pack'], {cwd: appDir}).output[1]
    const tarball = path.join(appDir, pack.toString().trim())
    try {
      // cd immediateDir && tar xf tarball
      await tar.x({file: tarball, cwd: immediateDir})
    } finally {
      await ignoreError(fs.remove(tarball))
    }
    // cd immediateDir && npm install --production
    const env = Object.create(process.env)
    env.npm_config_platform = platform
    env.npm_config_arch = arch
    env.yackage = 'true'
    spawnSync('npm', ['install', '--production'], {cwd: freshDir, env})
  } catch(e) {
    await ignoreError(fs.remove(immediateDir))
    throw e
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

// Package the app with Yode.
async function packageApp(outputDir, appDir, options, version, platform, arch, cacheDir) {
  const packageJson = await fs.readJson(path.join(appDir, 'package.json'))
  const name = packageJson.name ? packageJson.name : 'myapp'
  let target = path.join(outputDir, platform == 'win32' ? `${name}.exe` : name)
  const yodePath = await downloadYode(version, platform, arch, cacheDir)
  const freshDir = await installApp(appDir)
  const intermediate = path.join(outputDir, 'app.ear')
  try {
    const asarOpts = {
      transform: transform.bind(this, freshDir),
      unpack: options.unpack,
      globOptions: {ignore}
    }
    await createPackage(freshDir, intermediate, asarOpts)
    await appendMeta(intermediate)
    await fs.ensureDir(outputDir)
    await cat(target, yodePath, intermediate)
    await fs.chmod(target, 0o755)
    const resDir = path.join(outputDir, 'res')
    await ignoreError(fs.remove(resDir))
    await ignoreError(fs.rename(`${intermediate}.unpacked`, resDir))
  } finally {
    // Cleanup.
    await ignoreError(fs.remove(freshDir))
    await ignoreError(fs.remove(intermediate))
    await ignoreError(fs.remove(`${intermediate}.unpacked`))
  }
  // Platform specific settings.
  if (platform === 'darwin')
    target = await require('./mac').createBundle(packageJson, appDir, outputDir, target)
  return target
}

module.exports = { downloadYode, getLatestYodeVersion, packageApp }
