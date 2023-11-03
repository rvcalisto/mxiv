const { contextBridge, ipcRenderer } = require("electron")
const { webFrame } = require("electron/renderer")
const tagAPI = require("./APIs/tagAPI.js")
const zipAPI = require('./APIs/zipAPI') // exposed for debugging, remove later
const libAPI = require('./APIs/libAPI')
const fileAPI = require('./APIs/fileAPI')
const openAPI = require("./APIs/openAPI")


contextBridge.exposeInMainWorld('elecAPI', {

  tagAPI:  tagAPI,      // tag, untag, filter files. [book.js] 
  zipAPI:  zipAPI,      // exposed for debugging, remove later
  libAPI:  libAPI,      // library, cover thumbnails [library.js]
  fileAPI: fileAPI,     // everything file related [book.js, fileExplorer.js, statusBar.js]

  // open files/dirs/.zips on book.js [book.js]
  open: (path, ownerID) => openAPI.open(path, ownerID), // maybe merge with fileAPI
  clearTmp: (ownerID) => openAPI.clearTmp(ownerID),
  clearCache: () => webFrame.clearCache(),

  // open tabs from main.js (cmdline) [index.js]
  onOpen: (details) => ipcRenderer.on('viewer:open', details),

  // open native file dialog [library.js]
  dialog: (options) => ipcRenderer.invoke('dialog', options),

  // app window
  newWindow: () => ipcRenderer.invoke('window:new'), // new window instance [commands.js]
  toggleFullscreen: () => ipcRenderer.invoke('window:fullscreen') // [viewer.js, commands.js]
})
