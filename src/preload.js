const { contextBridge, ipcRenderer } = require("electron")
const { webFrame } = require("electron/renderer")
const { pathToFileURL } = require('url')
const localTagStorage = require('./APIs/tag/renderer')


contextBridge.exposeInMainWorld('elecAPI', {

  // coordination
  requestLock: async () => ipcRenderer.invoke('coord:lock'),
  releaseLock: async () => ipcRenderer.invoke('coord:unlock'),
  broadcast: async (message, ...args) => ipcRenderer.invoke('coord:broadcast', message, ...args),
  onBroadcast: (...args) => ipcRenderer.on('coord:onbroadcast', ...args),

  // library
  addToLibrary: async (path, recursively) => ipcRenderer.invoke('library:add', path, recursively),
  getLibraryEntries: () => ipcRenderer.invoke('library:get'),
  removeFromLibrary: async (path) => ipcRenderer.invoke('library:remove', path),
  clearLibrary: async () => ipcRenderer.invoke('library:clear'),
  onLibraryNew: (infoObj) => ipcRenderer.on('library:new', infoObj),

  // open files
  openFile: async (path, ownerID) => ipcRenderer.invoke('file:open', path, ownerID),
  clearTmp: async (ownerID) => ipcRenderer.invoke('file:clearTmp', ownerID),
  clearCache: () => webFrame.clearCache(),

  // operate on file
  getFileURL: (path) => pathToFileURL(path).href,
  runOnFile: async (userScript, currentFile) => ipcRenderer.invoke('file:runScript', userScript, currentFile),
  deleteFile: async (path) => ipcRenderer.invoke('file:delete', path),

  // discover files
  queryPath: async (path) => ipcRenderer.invoke('file:queryPath', path),
  scanPath: async (path) => ipcRenderer.invoke('file:scanPath', path),

  // manage file tags
  uniqueTags: () => localTagStorage.uniqueTags(), // renderer, for non-blocking sync
  getTags: (path) => localTagStorage.getTags(path), // renderer, for non-blocking sync
  addTags: async (path, ...tags) => ipcRenderer.invoke('tags:add', path, ...tags),
  removeTags: async (path, ...tags) => ipcRenderer.invoke('tags:remove', path, ...tags),
  
  // app window
  newWindow: async () => ipcRenderer.invoke('window:new'),
  dialog: (options) => ipcRenderer.invoke('window:dialog', options),
  onOpen: (details) => ipcRenderer.on('window:open', details),
  toggleFullscreen: async () => ipcRenderer.invoke('window:fullscreen'),
  onFullscreen: (isFullscreen) => ipcRenderer.on('window:onFullscreen', isFullscreen),
})