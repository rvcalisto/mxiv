const os = require('os');
const path = require('path');
const { TagStorage } = require('./tagStorage');
const { ipcRenderer } = require('electron');


/**
 * Persistent tag storage file. 
 */
const storageFile = process.platform === 'win32' ?
  path.join(process.env.LOCALAPPDATA, 'mxiv', 'tagDB.json') :
  path.join(os.homedir(), '.cache', 'mxiv', 'tagDB.json')


/**
 * Tag Storage to read-only in renderer process.
 */
const tagDB = new TagStorage(storageFile)


/**
 * Return file tags as an array.
 * @param {String} filePath Absolute path to file.
 * @returns {String[]}
 */
function getTags(filePath) {
  return tagDB.getTags(filePath)
}

/**
 * Return unique tags.
 * @returns {String[]}
 */
function uniqueTags() {
  return tagDB.uniqueTags()
}

/**
 * Return information object about the current DB state.
 */
function info() {
  return tagDB.info()
}

/**
 * List database entries whose files are no longer accessible.
 */
async function listOrphans() {
  tagDB.listOrphans(false)
}

/**
 * Listen for main process tag controller sync requests.
 * Sync tag storage state to persistent JSON file.
 */
ipcRenderer.on('tags:sync', async () => {
  await tagDB.loadDB()
  console.log('MXIV::Tag Controller: synced')
})


module.exports = { getTags, uniqueTags, info, listOrphans }