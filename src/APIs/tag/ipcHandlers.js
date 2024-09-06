import { ipcMain } from 'electron'
import * as mainTagStorage from './main.js'


ipcMain.handle('tags:add', async (e, path, ...tags) => {
  return await mainTagStorage.tagFile(path, ...tags)
})

ipcMain.handle('tags:remove', async (e, path, ...tags) => {
  return await mainTagStorage.untagFile(path, ...tags)
})
