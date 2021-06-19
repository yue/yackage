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
    minify: true,
    unpack: '*.node',
  }
  Object.assign(opts, program)
  if (!opts.cacheDir)
    opts.cacheDir = path.join(opts.appDir, 'yode')
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
       .description('Package Node.js project with Yode')
       .option('--platform <platform>', 'Target platform')
       .option('--arch <arch>', 'Target arch')
       .option('--app-dir <dir>', 'Path to the app')
       .option('--unpack <pattern>', 'Passed to asar utility')

program.command('build <outputDir>')
       .description('Build exetutable file from app')
       .action(build)

program.command('dist <outputDir>')
       .description('Build and generate distribution')
       .action(dist)

program.command('*')
       .action((cmd) => {
         console.error(`yackage: ${cmd} is not a command.`)
       })

program.parse(process.argv)

if (process.argv.length == 2)
  program.outputHelp()

process.on('unhandledRejection', r => {
  console.error(r)
  process.exit(1)
})
