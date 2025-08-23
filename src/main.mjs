import { app, BrowserWindow, ipcMain, dialog, Menu, nativeTheme } from 'electron';
import { join, isAbsolute } from 'path';
import { initializeDataDirectory } from './APIs/tool/appPaths.js';


/**
 * Create tabs from `--tab`, `-t` command line arguments.
 * @param {string[]} [args] Custom argument array.
 * @returns {string[][]}
 */
function tabArguments(args = process.argv) {
  const tabs = /** @type {string[][]} */ ([]);
  let idx = -1;

  // create non-empty tab path arrays
  for (const arg of args) {
    if (arg === '--tab' || arg === '-t')
      idx++;
    else if (idx > -1 && arg[0] !== '-') { 
      tabs[idx] == null ? tabs[idx] = [arg] : tabs[idx].push(arg);
    }
  }

  return tabs;
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

  ipcMain.handle('window:dialog', (e, /** @type {'open'|'message'} */ type, options) => {
    const window = /** @type {Electron.BrowserWindow} */ (BrowserWindow.fromWebContents(e.sender));

    if (type === 'open')
      return dialog.showOpenDialogSync(window, options);
    else
      return dialog.showMessageBoxSync(window, options);
  });

  ipcMain.handle('window:fullscreen', () => {
    const win = /** @type {Electron.BrowserWindow} */ (BrowserWindow.getFocusedWindow());
    const newState = !win.fullScreen;
    
    win.setFullScreen(newState);
    win.webContents.send('window:onFullscreen', newState);
    return newState;
  });

  ipcMain.handle('window:theme', (_e, theme) => {
    nativeTheme.themeSource = theme;
  });
}


// quit as part of the squirrel.windows installation procedure, if present
if (process.platform === 'win32' && await import('electron-squirrel-startup')
  .then(module => module.default)
  .catch(_ => false)
) {
  app.quit();
}

// quit on duplicated instance, avoid localStorage lock and resource duplication
else if ( !app.requestSingleInstanceLock(process.argv) ) {
  console.log('MXIV: Opening in existing instance.');
  app.quit();
}

// start application procedures
else {
  
  // Electron initialization complete, setup IPC handlers and create first window
  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    initializeDataDirectory();
    ipcHandlers();
  
    newWindow().then(win => {
      const tabs = tabArguments();

      if (tabs.length > 0)
        win.webContents.send('window:open', tabs);
      
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
  app.on('second-instance', (_, _argv, workingDirectory, userArgv) => {
    newWindow().then(win => {
      const tabs = tabArguments(/** @type {string[]} */ (userArgv));

      // relative paths still use main process working directory,
      // so solve relative paths to current process working directory.
      for (const tab of tabs) {
        for (let i = 0; i < tab.length; i++) {
          if ( !isAbsolute(tab[i]) )
            tab[i] = join(workingDirectory, tab[i]);
        }
      }

      if (tabs.length > 0)
        win.webContents.send('window:open', tabs);
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
