const fs       = require('fs-extra')
const os       = require('os')
const path     = require('path')
const fullname = require('fullname')
const sortPJ   = require('sort-package-json')
const spawn    = require('await-spawn')

const {mergeDeep} = require('./util')

function getDefaultPackageJson(name) {
  return {
    name,
    version: '0.1.0',
    main: 'lib/main.js',
    build: {
      appId: `org.${os.userInfo().username}.${name}`,
      productName: getProductName(name)
    },
    scripts: {
      start: 'yode .',
      build: 'yackage build out',
      dist: 'yackage dist out'
    },
    license: 'MIT',
    dependencies: {},
    devDependencies: {},
  }
}

function getProductName(name) {
  return name.replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => word.toUpperCase())
             .replace(/[-_]/g, ' ')
}

async function trimSpawn(cmd, args, options = {}) {
  return (await spawn(cmd, args, options)).toString().trim()
}

async function readGitInfo(targetDir) {
  const info = {}
  const originUrl = await trimSpawn('git', ['config', '--get', 'remote.origin.url'], {cwd: targetDir})
  if (!originUrl)
    return info
  info.repository = {type: "git", url: originUrl}
  const match = originUrl.match(/github.com\/([\w-_]+)\/([\w-_]+)/)
  if (!match)
    return info
  const [_, org, repo] = match
  info.name = repo
  info.homepage = `https://github.com/${org}/${repo}`
  info.bugs = {url: `${info.homepage}/issues`}
  info.build = {
    appId: `org.${org}.${repo}`,
    productName: getProductName(repo),
  }
  return info
}

async function initProject(type, targetDir) {
  if (await fs.pathExists(path.join(targetDir, 'package.json'))) {
    console.error('The target directory already includes a project')
    return
  }
  if (!await fs.pathExists(path.join(targetDir, '.git'))) {
    console.error('The target directory must be git-initialized')
    return
  }
  const packageJson = getDefaultPackageJson(path.basename(targetDir))
  await Promise.all([
    (async () => {
      let name
      const year = new Date().getFullYear()
      await Promise.all([
        fs.copy(path.join(__dirname, '..', 'templates', type), targetDir),
        (async () => {
          name = await fullname()
          packageJson.build.copyright = `Copyright © ${year} ${name}`
        })(),
      ])
      const license = path.join(targetDir, 'LICENSE')
      const content = await fs.readFile(license)
      await fs.writeFile(license, content.toString().replace('[YEAR]', year).replace('[NAME]', name))
    })(),
    (async () => {
      await fs.copy(path.join(__dirname, '..', 'resources'), path.join(targetDir, 'build'))
    })(),
    (async () => {
      try {
        mergeDeep(packageJson, await readGitInfo(targetDir))
      } catch (error) {}
    })(),
    (async () => {
      packageJson.dependencies.gui = '^' + await trimSpawn('npm', ['show', 'gui', 'version'])
    })(),
    (async () => {
      packageJson.dependencies['fetch-yode'] = '^' + await trimSpawn('npm', ['show', 'fetch-yode', 'version'])
    })(),
    (async () => {
      const yackagePackageJson = await fs.readJson(path.join(__dirname, '..', 'package.json'))
      packageJson.devDependencies['yackage'] = '^' + yackagePackageJson.version
    })(),
  ])
  const sortedPackageJson = sortPJ(packageJson, {
    sortOrder: ['name', 'version', 'main', 'build', 'scripts']
  })
  await fs.writeJson(path.join(targetDir, 'package.json'), sortedPackageJson, {spaces: 2})
}

module.exports = {initProject}
