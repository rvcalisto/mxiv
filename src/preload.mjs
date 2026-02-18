import { contextBridge, webUtils, ipcRenderer, webFrame } from 'electron';
import { pathToFileURL } from 'url';
import * as localTagStorage from './APIs/tag/renderer.js';


contextBridge.exposeInMainWorld('elecAPI', {

  // coordination
  requestLock: async () => ipcRenderer.invoke('coord:lock'),
  releaseLock: async () => ipcRenderer.invoke('coord:unlock'),
  broadcast: async (message, ...args) => ipcRenderer.invoke('coord:broadcast', message, ...args),
  onBroadcast: (callback) => ipcRenderer.on('coord:onbroadcast', (_e, msg, ...args) => callback(msg, ...args)),

  // library
  addToLibrary: async (path, recursively) => ipcRenderer.invoke('library:add', path, recursively),
  updateLibraryThumbnails: async () => ipcRenderer.invoke('library:thumbnails'),
  getLibraryEntries: () => ipcRenderer.invoke('library:get'),
  removeFromLibrary: async (path) => ipcRenderer.invoke('library:remove', path),
  clearLibrary: async () => ipcRenderer.invoke('library:clear'),
  onLibraryNew: (callback) => ipcRenderer.on('library:new', (_e, infoObj) => callback(infoObj)),

  // open files
  openFile: async (path, ownerID) => ipcRenderer.invoke('file:open', path, ownerID),
  clearTmp: async (ownerID) => ipcRenderer.invoke('file:clearTmp', ownerID),
  clearCache: () => webFrame.clearCache(),

  // operate on file
  getFileURL: (path) => pathToFileURL(path).href,
  runOnFile: async (userScript, currentFile) => ipcRenderer.invoke('file:runScript', userScript, currentFile),
  deleteFile: async (path) => ipcRenderer.invoke('file:delete', path),
  getPathForFile: (file) => webUtils.getPathForFile(file),

  // discover files
  queryPath: async (path) => ipcRenderer.invoke('file:queryPath', path),
  scanPath: async (path) => ipcRenderer.invoke('file:scanPath', path),

  // manage file tags
  uniqueTags: () => localTagStorage.uniqueTags(), // renderer, for non-blocking sync
  getTags: (path) => localTagStorage.getTags(path), // renderer, for non-blocking sync
  addTags: async (path, ...tags) => ipcRenderer.invoke('tags:add', path, ...tags),
  removeTags: async (path, ...tags) => ipcRenderer.invoke('tags:remove', path, ...tags),
  renameTags: async (...tags) => ipcRenderer.invoke('tags:rename', ...tags),
  deleteTags: async (...tags) => ipcRenderer.invoke('tags:delete', ...tags),

  // app window
  newWindow: async () => ipcRenderer.invoke('window:new'),
  dialog: (type, options) => ipcRenderer.invoke('window:dialog', type, options),
  onOpen: (callback) => ipcRenderer.on('window:open', (_e, details) => callback(details)),
  toggleFullscreen: async () => ipcRenderer.invoke('window:fullscreen'),
  onFullscreen: (callback) => ipcRenderer.on('window:onFullscreen', (_e, isFullscreen) => callback(isFullscreen)),
  setTheme: async (theme) => ipcRenderer.invoke('window:theme', theme)
});
