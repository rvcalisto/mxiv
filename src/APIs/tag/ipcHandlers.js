const { ipcMain } = require('electron')
const mainTagStorage = require('./main')


ipcMain.handle('tags:add', async (e, path, ...tags) => {
  return await mainTagStorage.tagFile(path, ...tags)
})

ipcMain.handle('tags:remove', async (e, path, ...tags) => {
  return await mainTagStorage.untagFile(path, ...tags)
})