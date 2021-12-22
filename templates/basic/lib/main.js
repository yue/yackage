const gui = require('gui')

require('./gc')

if (process.platform == 'darwin')
  gui.lifetime.onReady = main
else
  main()

function main() {
  if (process.platform != 'darwin') {
    const packageJson = require('../package.json')
    gui.app.setName(packageJson.build.productName)
    gui.app.setID(packageJson.build.appId)
  }

  const windowController = require('./window-controller')
  windowController.create()
}

if (!process.versions.yode) {
  gui.MessageLoop.run()
  process.exit(0)
}
