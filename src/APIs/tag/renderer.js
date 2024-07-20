const { TagStorage } = require('./tagStorage');
const { ipcRenderer } = require('electron');


/**
 * Tag Storage to read-only in renderer process.
 */
const tagStorage = new TagStorage()


/**
 * Return file tags as an array.
 * @param {String} filePath Absolute path to file.
 * @returns {String[]}
 */
function getTags(filePath) {
  return tagStorage.get(filePath)
}

/**
 * Return unique tags.
 * @returns {String[]}
 */
function uniqueTags() {
  return tagStorage.uniqueTags()
}

/**
 * Return information object about the current DB state.
 */
function info() {
  return tagStorage.info()
}

/**
 * List database entries whose files are no longer accessible.
 */
async function listOrphans() {
  tagStorage.listOrphans(false)
}

/**
 * Listen for main process tag controller sync requests.
 * Sync tag storage state to persistent JSON file.
 */
ipcRenderer.on('coord:onbroadcast', async (e, message) => {
  if (message === 'tags:sync') {
    await tagStorage.getPersistence()
    console.log('MXIV::broadcast: tags:sync')
  }
})


module.exports = { getTags, uniqueTags, info, listOrphans }