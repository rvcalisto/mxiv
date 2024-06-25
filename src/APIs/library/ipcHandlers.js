const { ipcMain } = require("electron");
const libraryMain = require("./main");


ipcMain.handle('library:lock', (e) => {
  return libraryMain.requestLock(e.sender.id)
})

ipcMain.handle('library:unlock', (e) => {
  return libraryMain.releaseLock(e.sender.id)
})

ipcMain.handle('library:add', async (e, path, recursively) => {
  return await libraryMain.addToLibrary(e.sender, path, recursively)
})

ipcMain.handle('library:get', async (e) => {
  return await libraryMain.getLibraryEntries()
})

ipcMain.handle('library:remove', async (e, path) => {
  return await libraryMain.removeFromLibrary(path)
})

ipcMain.handle('library:clear', async (e) => {
  return await libraryMain.clearLibrary()
})