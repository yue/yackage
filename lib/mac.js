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
  <string>{{PRODUCT_NAME}}</string>
  <key>CFBundleName</key>
  <string>{{PRODUCT_NAME}}</string>
  <key>CFBundleExecutable</key>
  <string>{{NAME}}</string>
  <key>CFBundleVersion</key>
  <string>{{VERSION}}</string>
  <key>CFBundleShortVersionString</key>
  <string>{{VERSION}}</string>
  <key>CFBundleIconFile</key>
  <string>icon.icns</string>
  <key>LSMinimumSystemVersion</key>
  <string>10.10.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSSupportsAutomaticGraphicsSwitching</key>
  <true/>
</dict>
</plist>
`.trim()

async function createBundle(appInfo, appDir, outputDir, target) {
  const bundleDir = `${outputDir}/${appInfo.productName}.app`
  await fs.remove(bundleDir)
  await fs.ensureDir(`${bundleDir}/Contents/Resources`)
  const exeDir = `${bundleDir}/Contents/MacOS`
  await fs.ensureDir(exeDir)
  await fs.rename(target, `${exeDir}/${appInfo.productName}`)
  await ignoreError(fs.rename(`${outputDir}/res`, `${exeDir}/res`))
  const infoPlist = infoPlistTemplate.replace(/{{NAME}}/g, appInfo.name)
                                     .replace(/{{PRODUCT_NAME}}/g, appInfo.productName)
                                     .replace(/{{IDENTIFIER}}/g, appInfo.appId)
                                     .replace(/{{VERSION}}/g, appInfo.version)
  await fs.writeFile(`${bundleDir}/Contents/Info.plist`, infoPlist)
  const iconTarget = `${bundleDir}/Contents/Resources/icon.icns`
  if (await fs.pathExists(`${appDir}/build/icon.icns`))
    await fs.copy(`${appDir}/build/icon.icns`, iconTarget)
  else
    await fs.copy(path.resolve(__dirname, '..', 'resources', 'icon.icns'), iconTarget)
  return bundleDir
}

module.exports = {createBundle}
