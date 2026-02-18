// @ts-check
import { ipcMain } from 'electron';
import * as mainTagStorage from './main.js';


ipcMain.handle('tags:add', async (_e, path, ...tags) => {
  return await mainTagStorage.tagFile(path, ...tags);
});

ipcMain.handle('tags:remove', async (_e, path, ...tags) => {
  return await mainTagStorage.untagFile(path, ...tags);
});

ipcMain.handle('tags:rename', async (_e, ...tags) => {
  return await mainTagStorage.renameTags(...tags);
});

ipcMain.handle('tags:delete', async (_e, ...tags) => {
  return await mainTagStorage.deleteTags(...tags);
});
