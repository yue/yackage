#!/usr/bin/env node

const os = require('os')
const program = require('commander')

const {packageApp} = require('..')

const opts = {
  yodeVersion: 'v0.2.0',
  yodePlatform: process.platform,
  yodeArch: process.arch,
  cacheDir: os.tmpdir(),
  options: {},
}

async function action(outputPath, appDir) {
  Object.assign(opts, program)
  console.log(await packageApp(
    outputPath, appDir, opts.options,
    opts.yodeVersion, opts.yodePlatform, opts.yodeArch, opts.cacheDir))
}

program.version('v' + require('../package.json').version)
       .description('Package Node.js project with Yode')
       .option('--yode-version',  'Yode version')
       .option('--yode-platform', 'Yode platform')
       .option('--yode-arch',     'Yode arch')
       .option('--cacheDir', 'Directory to store downloaded binaries')
       .arguments('<outputPath> <appDir>')
       .action(action)
       .parse(process.argv)

if (process.argv.length == 2)
  program.outputHelp()
