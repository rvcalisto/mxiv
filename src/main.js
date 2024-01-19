const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron')
const { join } = require('path')


/**
 * Get user path arguments from vector, if any.
 * @param {String[]} customArgv Custom argument array.
 * @returns {String[]}
 */
function pathsFromArgv(customArgv) {
  if (customArgv === undefined) customArgv = process.argv
  // filter away chromiun args (--some-chromium-flag)
  const argArr = customArgv.filter((arg) => arg[0] !== '-')
  return argArr.slice(2) // remove node bin & project main.js args
}


/**
 * Creates a new index window with app defaults.
 * @param {Electron.BrowserWindowConstructorOptions} options Additional options.
 * @returns {Promise<BrowserWindow>} New window reference.
 */
async function newWindow(options = {}) {

  /** @type {Electron.BrowserWindowConstructorOptions} */
  const defaults = {
    icon: join(__dirname, 'icons', 'mxiv.png'),
    width: 1100, height: 600, modal: false,
    autoHideMenuBar: true,
    backgroundColor: 'black',

    webPreferences: {
      sandbox: false, // electron 20 enables by default
      preload: join(__dirname, 'preload.js')
    }
  }

  // create and wait for new window to load before resolving
  const win = new BrowserWindow( Object.assign(defaults, options) )
  await win.loadFile( join(__dirname, 'index', 'index.html') )
  return win
};


/** Setup IPC handlers. */
function ipcHandlers() {

  // handle: open file dialog
  ipcMain.handle('dialog', (e, options) => {
    const window = BrowserWindow.fromWebContents(e.sender)
    const files = dialog.showOpenDialogSync(window, options)
    if (files) return files
  })

  // handle: new window
  ipcMain.handle('window:new', (e) => {
    newWindow()
  })

  ipcMain.handle('window:fullscreen', (e) => {
    const win = BrowserWindow.getFocusedWindow()
    const newState = !win.fullScreen
    win.setFullScreen(newState)
    win.send('window:onFullscreen', newState)
    return newState
  })
}


// squirrel.windows
if ( process.platform === 'win32' && require('electron-squirrel-startup') ) {
  app.quit()
  return
}


// enforce single instance, avoid localStorage lock and resource duplication
if ( !app.requestSingleInstanceLock() ) {
  console.log('Another instance is already running. Closing.')
  app.quit()
  return
}


// Electron initalization complete, setup IPC handlers and create first window
app.on('ready', () => {
  Menu.setApplicationMenu(null) // remove app menu bar
  ipcHandlers()

  newWindow().then((win) => {
    const pathArgs = pathsFromArgv()
    pathArgs.forEach(path => win.send('viewer:open', { paths: [path], newTab: true }))
  })
})


// set listener for new instances. Spawn new window and open paths if any
app.on('second-instance', (ev, argv) => {
  newWindow().then((win) => {
    const pathArgs = pathsFromArgv(argv); // console.log('2º instance pathArgs:', pathArgs)
    pathArgs.forEach(path => win.send('viewer:open', { paths: [path], newTab: true }))
  })
})


// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});


// On OS X it's common to re-create a window in the app when the
// dock icon is clicked and there are no other windows open.
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) newWindow();
});


// intercept inputs, check for ctrl+r, ctrl+q & ctrl+i to trigger 
// reload, quit and toggle-dev-tools for window without relying on 
// menu accelerators or global accelerators.
app.on('web-contents-created', (ev_, webContents) => {
  webContents.on('before-input-event', (ev, input) => {
    if (input.type === 'keyUp' || input.modifiers.length === 0) return 
    const key = input.key.toLowerCase()
    
    if (input.control && key === 'r') {
      ev.preventDefault()
      BrowserWindow.getFocusedWindow().reload()
    } else if (input.control && key === 'q') {
      ev.preventDefault()
      BrowserWindow.getFocusedWindow().close()
    } else if (input.control && input.shift && key === 'i') {
      ev.preventDefault()
      BrowserWindow.getFocusedWindow().webContents.toggleDevTools()
    }
  })
})
