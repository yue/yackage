#!/usr/bin/env node

const os = require('os')
const path = require('path')
const fs = require('fs-extra')
const program = require('commander')

const {getLatestYodeVersion, packageApp} = require('..')

async function parseOpts() {
  const opts = {
    platform: process.platform,
    arch: process.arch,
    appDir: process.cwd(),
    options: {},
  }
  Object.assign(opts, program)
  if (!opts.cacheDir)
    opts.cacheDir = path.join(opts.appDir, 'yode')
  if (!opts.yodeVersion) {
    const packageJson = await fs.readJson(path.join(opts.appDir, 'package.json'))
    if (packageJson.engines && packageJson.engines.yode)
      opts.yodeVersion = 'v' + packageJson.engines.yode
    else
      opts.yodeVersion = await getLatestYodeVersion()
  }
  opts.appDir = path.resolve(opts.appDir)
  opts.cacheDir = path.resolve(opts.cacheDir)
  return opts
}

async function build(outputDir) {
  const opts = await parseOpts()
  console.log(await packageApp(
    outputDir, opts.appDir, opts.options,
    opts.yodeVersion, opts.platform, opts.arch, opts.cacheDir))
}

program.version('v' + require('../package.json').version)
       .description('Package Node.js project with Yode')
       .option('--platform <platform>', 'Target platform')
       .option('--arch <arch>', 'Target arch')
       .option('--yode-version <version>', 'Yode version')
       .option('--app-dir <dir>', 'Path to the app')
       .option('--cache-dir <dir>', 'Directory to store downloaded binaries')

program.command('build <outputDir>')
       .description('Build exetutable file from app')
       .action(build)

program.command('*')
       .action((cmd) => {
         console.error(`yackage: ${cmd} is not a command.`)
       })

program.parse(process.argv)

if (process.argv.length == 2)
  program.outputHelp()

process.on('unhandledRejection', r => console.error(r))
