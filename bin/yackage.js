#!/usr/bin/env node

const os = require('os')
const path = require('path')
const program = require('commander')

const {packageApp} = require('..')

const opts = {
  yodeVersion: 'v0.3.0',
  platform: process.platform,
  arch: process.arch,
  cacheDir: os.tmpdir(),
  options: {},
}

async function action(outputDir, appDir) {
  Object.assign(opts, program)
  console.log(await packageApp(
    outputDir, appDir, opts.options,
    opts.yodeVersion, opts.platform, opts.arch,
    path.resolve(opts.cacheDir)))
}

program.version('v' + require('../package.json').version)
       .description('Package Node.js project with Yode')
       .option('--platform <platform>', 'Target platform')
       .option('--arch <arch>', 'Target arch')
       .option('--yode-version <version>', 'Yode version')
       .option('--cache-dir <dir>', 'Directory to store downloaded binaries')
       .arguments('<outputDir> <appDir>')
       .action(action)
       .parse(process.argv)

if (process.argv.length == 2)
  program.outputHelp()

process.on('unhandledRejection', r => console.error(r))
