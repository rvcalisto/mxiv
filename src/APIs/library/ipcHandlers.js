const { ipcMain } = require("electron");
const libraryMain = require("./main");


ipcMain.handle('library:getCandidates', async (e, path, recursively) => {
  return await libraryMain.getCandidates(path, recursively)
})

ipcMain.handle('library:createThumbnail', async (e, path) => {
  return await libraryMain.createThumbnail(path)
})

ipcMain.handle('library:deleteThumbnail', async (e, path) => {
  return await libraryMain.deleteThumbnail(path)
})

ipcMain.handle('library:createThumbnailDirectory', async (e) => {
  return await libraryMain.createThumbnailDirectory()
})

ipcMain.handle('library:deleteThumbnailDirectory', async (e, path) => {
  return await libraryMain.deleteThumbnailDirectory(path)
})