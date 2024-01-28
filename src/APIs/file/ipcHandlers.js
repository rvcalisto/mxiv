const { ipcMain } = require("electron")
const openFile = require('./openFile')
const fileSearch = require('./fileSearch')
const fileTools = require('./fileTools')


// open files
ipcMain.handle('file:open', async (e, path, ownerID) => {
  return await openFile.open(path, ownerID)
})

ipcMain.handle('file:clearTmp', (e, ownerID) => {
  openFile.clearTmp(ownerID)
})

// operate on file
ipcMain.handle('file:runScript', (e, userScript, currentFile) => {
  return fileTools.runOnFile(userScript, currentFile)
})

ipcMain.handle('file:delete', (e, path) => {
  fileTools.deleteFile(path)
})

// file discovery
ipcMain.handle('file:queryPath', async (e, path) => {
  return await fileSearch.listPaths(path)
})

ipcMain.handle('file:scanPath', async (e, path) => {
  return await fileSearch.listFiles(path)
})