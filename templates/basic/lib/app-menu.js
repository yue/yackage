const gui = require('gui')

class AppMenu {
  constructor(win) {
    if (process.platform != 'darwin')
      this.win = win

    const menus = []

    const quitMenu = [
      {
        label: 'Collect Garbage',
        accelerator: 'CmdOrCtrl+Shift+G',
        onClick() { process.gc(true) },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        accelerator: 'CmdOrCtrl+Q',
        onClick() { require('./window-controller').quit() },
      },
    ]

    if (process.platform == 'darwin') {
      menus.push({
        label: require('../package.json').build.productName,
        submenu: quitMenu.concat([
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hide-others' },
          { type: 'separator' },
        ]),
      })
    }

    menus.push({
      label: 'File',
      submenu: [
        { role: 'close-window' },
      ],
    })

    if (process.platform == 'darwin') {
      menus.push({
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'select-all' },
        ],
      })
    } else {
      menus[0].submenu = menus[0].submenu.concat(quitMenu)
    }

    if (process.platform == 'darwin') {
      menus.push({
        label: 'Window',
        role: 'window',
        submenu: [
          { role: 'minimize' },
          { role: 'maximize' },
        ],
      })
    }

    this.menu = gui.MenuBar.create(menus)
  }
}

module.exports = AppMenu

