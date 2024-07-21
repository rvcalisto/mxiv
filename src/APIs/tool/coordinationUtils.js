const { BrowserWindow } = require("electron");
const { ipcMain } = require("electron");


/**
 * Library mutual exclusivity lock object.
 * @type {Object<string, boolean>}
 */
const mutexLocks = {};

/**
 * Request mutex lock.
 * @param {string} name Lock identifier.
 * @returns {Boolean} Success
 */
function requestLock(name) {
  if (mutexLocks[name]) return false;

  mutexLocks[name] = true;
  return true;
}

/**
 * Release mutex lock.
 * @param {Number} name Lock identifier.
 */
function releaseLock(name) {
  mutexLocks[name] = false;
}

/**
 * Broadcast message to all window instances.
 * @param {string} message Message identifier.
 * @param  {...any} payload Additional arguments.
 */
function broadcast(message, ...payload) {
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('coord:onbroadcast', message, ...payload);
  });
}


/**
 * IPC Handlers
 */
ipcMain.handle('coord:lock', (e, name) => {
  return requestLock(name);
});

ipcMain.handle('coord:unlock', (e, name) => {
  return releaseLock(name);
});

ipcMain.handle('coord:broadcast', (e, message, ...args) => {
  BrowserWindow.getAllWindows().forEach(win => {
    if (win.webContents.id !== e.sender.id) // skip sender
      win.webContents.send('coord:onbroadcast', message, ...args);
  });
});


module.exports = { requestLock, releaseLock, broadcast };
