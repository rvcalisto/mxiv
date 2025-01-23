import { app, BrowserWindow, ipcMain, dialog, Menu, nativeTheme } from 'electron';
import { join } from 'path';
import { initializeBase } from './APIs/tool/appPaths.js';


/**
 * Get user path arguments from vector, if any.
 * @param {String[]} [customArgv] Custom argument array.
 * @returns {String[]}
 */
function pathsFromArgv(customArgv = process.argv) {
  // filter away process, file and chromiun args (--some-chromium-flag)
  return customArgv.slice(2).filter(arg => arg[0] !== '-');
}


/**
 * Creates a new index window with app defaults.
 * @param {Electron.BrowserWindowConstructorOptions} options Additional options.
 * @returns {Promise<BrowserWindow>} New window reference.
 */
async function newWindow(options = {}) {
  const directory = import.meta.dirname;

  /**
   * @type {Electron.BrowserWindowConstructorOptions}
   */
  const defaults = {
    icon: join(directory, 'icons', 'mxiv.png'),
    width: 1100, height: 600,
    modal: false,
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? 'black' : 'white',

    webPreferences: {
      sandbox: false, // electron 20 enables by default
      preload: join(directory, 'preload.mjs')
    }
  };

  // create and wait for new window to load before resolving
  const win = new BrowserWindow( Object.assign(defaults, options) );
  await win.loadFile( join(directory, 'index', 'index.html') );
  return win;
};


/**
 * Setup window IPC handlers.
 */
function ipcHandlers() {

  // IPC modules handlers as side-effect
  import('./APIs/library/ipcHandlers.js');
  import('./APIs/file/ipcHandlers.js');
  import('./APIs/tag/ipcHandlers.js');
  import('./APIs/tool/coordinationUtils.js');

  // window handlers
  ipcMain.handle('window:new', () => {
    newWindow();
  });

  ipcMain.handle('window:dialog', (e, options) => {
    const window = BrowserWindow.fromWebContents(e.sender);
    const files = dialog.showOpenDialogSync(window, options);
    
    if (files)
      return files;
  });

  ipcMain.handle('window:fullscreen', () => {
    const win = BrowserWindow.getFocusedWindow();
    const newState = !win.fullScreen;
    
    win.setFullScreen(newState);
    win.webContents.send('window:onFullscreen', newState);
    return newState;
  });

  ipcMain.handle('window:theme', (_e, theme) => {
    nativeTheme.themeSource = theme;
  });
}


// quit as part of the squirrel.windows installation procedure
if ( process.platform === 'win32' && (await import('electron-squirrel-startup')).default ) {
  app.quit();
}

// quit on duplicated instance, avoid localStorage lock and resource duplication
else if ( !app.requestSingleInstanceLock() ) {
  console.log('MXIV: Another instance is already running. Closing.');
  app.quit();
}

// start application procedures
else {
  
  // Electron initialization complete, setup IPC handlers and create first window
  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    await initializeBase();
    ipcHandlers();
  
    newWindow().then(win => {
      const pathArgs = pathsFromArgv();
      
      if (pathArgs.length > 0)
        win.webContents.send('window:open', { paths: pathArgs, newTab: true });
      
      // apply theme override on first new window, if any.
      // TODO: apply before window creation to avoid flashing the wrong background
      win.webContents.executeJavaScript(`localStorage.getItem('themeOverride')`)
        .then((/** @type {'light'|'dark'|'system'?} */ theme) => {
          if (theme != null)
            nativeTheme.themeSource = theme;
        }); 
    });
  });
  
  
  // set listener for new instances. Spawn new window and open paths if any
  app.on('second-instance', (_, argv) => {
    newWindow().then(win => {
      // NOTE: relative paths will still use main process CWD...
      const pathArgs = pathsFromArgv(argv);
      
      if (pathArgs.length > 0)
        win.webContents.send('window:open', { paths: pathArgs, newTab: true });
    });
  });
  
  
  // Quit when all windows are closed, except on macOS. There, it's common
  // for applications and their menu bar to stay active until the user quits
  // explicitly with Cmd + Q.
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
      app.quit();
  });
  
  
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length < 1)
      newWindow();
  });
  
  
  // Register window shortcuts for Reload (Ctrl+r), DevTools (Ctrl+i)
  // and Quit (Ctrl+q) without relying on global accelerators.
  app.on('web-contents-created', (_, webContents) => {
    webContents.on('before-input-event', (e, input) => {
      if (!input.control || input.type === 'keyUp')
        return;
      
      const key = input.key.toLowerCase();
  
      if (!input.shift && key === 'r') {
        e.preventDefault();
        webContents.reload();
      } else if (!input.shift && key === 'q') {
        e.preventDefault();
        webContents.close({ waitForBeforeUnload: true });
      } else if (input.shift && key === 'i') {
        e.preventDefault();
        webContents.toggleDevTools();
      }
    });
  });
}
