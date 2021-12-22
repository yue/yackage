const gui = require('gui')

const AppMenu = require('./app-menu')
const Window = require('./window')

class WindowController {
  constructor() {
    if (process.platform == 'darwin') {
      this.appMenu = new AppMenu()
      gui.app.setApplicationMenu(this.appMenu.menu)
    }
    this.windows = new Set()
  }

  create() {
    const win = new Window()
    win.window.center()
    win.window.activate()
    win.window.onClose = () => {
      this.windows.delete(win)
      this.quitIfAllClosed()
    }
    this.windows.add(win)
  }

  quitIfAllClosed() {
    if (process.platform == 'darwin')
      return
    if (this.windows.size == 0)
      this.quit()
  }

  quit() {
    gui.MessageLoop.quit()
    process.exit(0)
  }
}

module.exports = new WindowController
