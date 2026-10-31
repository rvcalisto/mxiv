import { ipcMain } from 'electron';
import * as libraryMain from './main.js';


ipcMain.handle('library:add', async (e, path) => {
  return await libraryMain.addToLibrary(e.sender, path);
});

ipcMain.handle('library:thumbnails', async (e) => {
  return await libraryMain.updateThumbnails(e.sender);
});

ipcMain.handle('library:get', async (_) => {
  return await libraryMain.getLibraryEntries();
});

ipcMain.handle('library:remove', async (_, path) => {
  return await libraryMain.removeFromLibrary(path);
});

ipcMain.handle('library:clear', async (_) => {
  return await libraryMain.clearLibrary();
});
