const fs     = require('fs-extra')
const util   = require('util')
const rcedit = require('rcedit')

async function modifyExe(exePath, appInfo, appDir) {
  const options = {
    'version-string': {
      FileDescription: appInfo.description,
      ProductName: appInfo.productName,
      LegalCopyright: appInfo.copyright,
    },
    'file-version': appInfo.version,
    'product-version': appInfo.version,
  }
  const iconPath = `${appDir}/build/icon.ico`
  if (await fs.pathExists(iconPath))
    options['icon'] = iconPath
  return await util.promisify(rcedit)(exePath, options)
}

module.exports = {modifyExe}
