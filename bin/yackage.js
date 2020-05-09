#!/usr/bin/env node

const os = require('os')
const path = require('path')
const fs = require('fs-extra')
const program = require('commander')

const {spawn} = require('child_process')
const {packageApp} = require('../lib/main')
const {createZip} = require('../lib/dist')
const {getLatestYodeVersion} = require('../lib/util.js')

async function parseOpts() {
  const opts = {
    platform: process.env.npm_config_platform ? process.env.npm_config_platform
                                              : process.platform,
    arch: process.env.npm_config_arch ? process.env.npm_config_arch
                                      : process.arch,
    appDir: process.cwd(),
    options: {
      unpack: '*.node',
    },
  }
  Object.assign(opts, program)
  if (!opts.cacheDir)
    opts.cacheDir = path.join(opts.appDir, 'yode')
  if (!opts.yodeVersion) {
    const packageJson = await fs.readJson(path.join(opts.appDir, 'package.json'))
    if (packageJson.engines && packageJson.engines.yode)
      opts.yodeVersion = 'v' + packageJson.engines.yode
    else
      opts.yodeVersion = await getLatestYodeVersion(opts.cacheDir)
  }
  if (opts.unpack) {
    opts.options.unpack = opts.unpack
    delete opts.unpack
  }
  opts.appDir = path.resolve(opts.appDir)
  opts.cacheDir = path.resolve(opts.cacheDir)
  return opts
}

async function build(outputDir) {
  const opts = await parseOpts()
  await packageApp(
    outputDir, opts.appDir, opts.options,
    opts.yodeVersion, opts.platform, opts.arch, opts.cacheDir)
}

async function dist(outputDir) {
  const opts = await parseOpts()
  const target = await packageApp(
    outputDir, opts.appDir, opts.options,
    opts.yodeVersion, opts.platform, opts.arch, opts.cacheDir)
  await createZip(opts.appDir, opts.platform, opts.arch, target)
}

async function start() {
  const opts = await parseOpts()
  const yode = path.resolve(
    opts.cacheDir,
    `yode-${opts.yodeVersion}-${opts.platform}-${opts.arch}`,
    process.platform == 'win32' ? 'yode.exe' : 'yode')
  const child = spawn(yode, [opts.appDir])
  child.stdout.pipe(process.stdout)
  child.stderr.pipe(process.stderr)
}

program.version('v' + require('../package.json').version)
       .description('Package Node.js project with Yode')
       .option('--platform <platform>', 'Target platform')
       .option('--arch <arch>', 'Target arch')
       .option('--yode-version <version>', 'Yode version')
       .option('--app-dir <dir>', 'Path to the app')
       .option('--cache-dir <dir>', 'Directory to store downloaded binaries')
       .option('--unpack <pattern>', 'Passed to asar utility')

program.command('build <outputDir>')
       .description('Build exetutable file from app')
       .action(build)

program.command('dist <outputDir>')
       .description('Build and generate distribution')
       .action(dist)

program.command('start')
       .description('Run app with Yode')
       .action(start)

program.command('*')
       .action((cmd) => {
         console.error(`yackage: ${cmd} is not a command.`)
       })

program.parse(process.argv)

if (process.argv.length == 2)
  program.outputHelp()

process.on('unhandledRejection', r => console.error(r))
