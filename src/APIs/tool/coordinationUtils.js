import { BrowserWindow, ipcMain } from 'electron';


/**
 * Registered mutual exclusivity locks.
 * @type {Set<string>}
 */
const mutexLocks = new Set();


/**
 * Broadcast message to all window instances.
 * @param {string} message Message identifier.
 * @param {...any} payload Additional arguments.
 */
export function broadcast(message, ...payload) {
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('coord:onbroadcast', message, ...payload);
  });
}


/**
 * IPC Handlers
 */
ipcMain.handle('coord:lock', (_, name, _waitLock) => {
  if ( mutexLocks.has(name) )
    return false;

  // TODO: implement wait lock, maybe.
  mutexLocks.add(name);

  return true;
});

ipcMain.handle('coord:unlock', (_, name) => {
  mutexLocks.delete(name);
});

ipcMain.handle('coord:broadcast', (e, message, ...args) => {
  BrowserWindow.getAllWindows().forEach(win => {
    if (win.webContents.id !== e.sender.id) // skip sender
      win.webContents.send('coord:onbroadcast', message, ...args);
  });
});
