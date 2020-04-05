#!/usr/bin/env node

const os = require('os')
const path = require('path')
const fs = require('fs-extra')
const program = require('commander')

const {spawn} = require('child_process')
const {downloadYode, getLatestYodeVersion, packageApp} = require('../lib/main')
const {createZip} = require('../lib/dist')

async function parseOpts() {
  const opts = {
    platform: process.platform,
    arch: process.arch,
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

async function install() {
  const opts = await parseOpts()
  await downloadYode(opts.yodeVersion, opts.platform, opts.arch, opts.cacheDir)
}

async function start() {
  const opts = await parseOpts()
  const yode = path.resolve(
    opts.cacheDir,
    `yode-${opts.yodeVersion}-${opts.platform}-${opts.arch}`,
    process.platform == 'win32' ? 'yode.exe' : 'yode')
  const args = [opts.appDir].concat(program.args.slice(0, program.args.length - 1));
  const child = spawn(yode, args);
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

program.command('install')
       .description('Download Yode for current platform')
       .action(install)

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
