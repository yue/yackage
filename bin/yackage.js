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
    platform: process.env.npm_config_platform || process.platform,
    arch: process.env.npm_config_arch || process.arch,
    appDir: process.cwd(),
    unpack: '*.node',
    minify: true,
    extraInfoPlist: '',
  }
  Object.assign(opts, program.opts())
  opts.appDir = path.resolve(opts.appDir)
  return opts
}

async function build(outputDir) {
  const opts = await parseOpts()
  await packageApp(
    outputDir, opts.appDir, opts, opts.platform, opts.arch)
}

async function dist(outputDir) {
  const opts = await parseOpts()
  const target = await packageApp(
    outputDir, opts.appDir, opts, opts.platform, opts.arch)
  await createZip(opts.appDir, opts.platform, opts.arch, target)
}

program.version('v' + require('../package.json').version)
       .description('Package Node.js project into app bundle with Yode')
       .option('--platform <platform>',
               'Target platform (default: $npm_config_platform || process.platform)')
       .option('--arch <arch>',
               'Target arch (default: $npm_config_arch || process.arch)')
       .option('--app-dir <dir>',
               'Path to the source code dir of app (default: current working dir)')
       .option('--unpack <pattern>',
               'Files to ignore when generating asar package (default: *.node)')
       .option('--no-minify',
               'Do not minify the JavaScript source code')
       .option('--extra-info-plist',
               'The extra string to insert into the Info.plist')

program.command('build <outputDir>')
       .description('Build app bundle')
       .action(build)

program.command('dist <outputDir>')
       .description('Build app bundle and generate app distribution')
       .action(dist)

program.parse(process.argv)

if (process.argv.length == 2)
  program.outputHelp()

process.on('unhandledRejection', r => {
  console.error(r)
  process.exit(1)
})
