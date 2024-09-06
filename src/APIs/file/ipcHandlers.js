import { ipcMain } from 'electron'
import * as openFile from './openFile.js'
import * as fileSearch from './fileSearch.js'
import * as fileTools from './fileTools.js'


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
  return fileTools.deleteFile(path)
})

// file discovery
ipcMain.handle('file:queryPath', async (e, path) => {
  return await fileSearch.listPaths(path)
})

ipcMain.handle('file:scanPath', async (e, path) => {
  return await fileSearch.listFiles(path)
})
