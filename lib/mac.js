const path = require('path')
const fs   = require('fs-extra')

const {ignoreError} = require('./util')

const infoPlistTemplate = `
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleIdentifier</key>
  <string>{{IDENTIFIER}}</string>
  <key>CFBundleDisplayName</key>
  <string>{{NAME}}</string>
  <key>CFBundleName</key>
  <string>{{NAME}}</string>
  <key>CFBundleExecutable</key>
  <string>{{NAME}}</string>
  <key>CFBundleVersion</key>
  <string>{{VERSION}}</string>
  <key>CFBundleShortVersionString</key>
  <string>{{VERSION}}</string>
  <key>LSMinimumSystemVersion</key>
  <string>10.10.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSSupportsAutomaticGraphicsSwitching</key>
  <true/>
</dict>
</plist>
`.trim()

async function createBundle(packageJson, outputDir, target) {
  const name = packageJson.productName ? packageJson.productName : packageJson.name
  const bundleDir = `${outputDir}/${name}.app`
  await fs.remove(bundleDir)
  const exeDir = `${bundleDir}/Contents/MacOS`
  await fs.ensureDir(exeDir)
  await fs.rename(target, `${exeDir}/${name}`)
  await ignoreError(fs.rename(`${outputDir}/res`, `${exeDir}/res`))
  const appId = (packageJson.build && packageJson.build.appId) ? packageJson.build.appId
                                                               : `com.${packageJson.name}.${packageJson.name}`
  const infoPlist = infoPlistTemplate.replace(/{{NAME}}/g, name)
                                     .replace(/{{IDENTIFIER}}/g, appId)
                                     .replace(/{{VERSION}}/g, packageJson.version)
  await fs.writeFile(`${bundleDir}/Contents/Info.plist`, infoPlist)
  return bundleDir
}

module.exports = {createBundle}
