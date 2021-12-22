const gui = require('gui')

const AppMenu = require('./app-menu')

class Window {
  constructor() {
    this.window = gui.Window.create({})
    this.window.setContentSize({width: 400, height: 400})
    this.window.setContentView(gui.Label.create('Hello World'))
    if (process.platform != 'darwin') {
      this.menu = new AppMenu(this)
      this.window.setMenuBar(this.menu.menu)
    }
  }
}

module.exports = Window
