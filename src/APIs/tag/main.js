const os = require('os');
const path = require('path');
const { mkdir } = require('fs');
const { TagStorage } = require('./tagStorage');
const { BrowserWindow } = require('electron');


/**
 * Persistent tag storage file. 
 */
const storageFile = process.platform === 'win32' ?
  path.join(process.env.LOCALAPPDATA, 'mxiv', 'tagDB.json') :
  path.join(os.homedir(), '.cache', 'mxiv', 'tagDB.json')


/**
 * Tag Storage to atomically transact with in main process.
 */
const tagDB = new TagStorage(storageFile)


/**
 * Add tags to entry and save changes to storage.
 * @param {String} filePath 
 * @param {String[]} tags
 * @returns {Promise<Boolean>}
 */
async function tagFile(filePath, ...tags) {
  // sync before
  await tagDB.loadDB()

  let tagsAdded = 0
  const newTags = tagDB.getTags(filePath)
  
  // don't add duplicates
  for (const tag of tags) {
    if ( newTags.includes(tag) ) continue
    newTags.push(tag)
    tagsAdded++
  }

  // save to storage
  tagDB.setTags(filePath, newTags)
  if (tagsAdded) return await tagDB.storeDB()
  else return false
}

/**
 * Remove tags from entry and save changes to storage.
 * @param {String} filePath 
 * @param {String[]} tags
 * @returns {Promise<Boolean>}
 */
async function untagFile(filePath, ...tags) {
  // sync before
  await tagDB.loadDB()

  let tagsRemoved = 0
  const newTags = tagDB.getTags(filePath)
  if (newTags.length === 0) return false
  
  for (const tag of tags) {
    const idx = newTags.indexOf(tag)
    if (idx > -1) {
      newTags.splice(idx, 1)
      tagsRemoved++
    }
  }

  // save to storage
  tagDB.setTags(filePath, newTags)
  if (tagsRemoved) return await tagDB.storeDB()
  else return false
}

/**
 * List database entries whose files are no longer accessible.
 * @param {false} deleteOrphans Either to delete orphans entries if found.
 */
async function listOrphans(deleteOrphans = false) {
  await tagDB.listOrphans(deleteOrphans)
}

/**
 * Recursively create storage file if not already created.
 * @returns {Promise<boolean>} Success.
 */
async function createTagStorageFile() {
  return await new Promise(resolve => {
    mkdir( path.dirname(storageFile), { recursive: true }, async (err) => {
      if (err) {
        console.log('MXIV: Failed to create storage directory.\n', err)
      } else {
        console.log('MXIV: Created tag JSON storage at:', storageFile) 
        await tagDB.storeDB()
      }
      resolve(!err)
    })
  })
}

/**
 * Create storageFile in filesystem if not created, monitor, re-sync,
 * and broadcast sync IPC request on detected fileStorage changes.
 */
async function initialize() {
  const success = await tagDB.loadDB()
  if (!success) {
    console.log('MXIV: Tag storage file not found. Creating...') 
    if ( !await createTagStorageFile() ) return
  }

  tagDB.monitorChanges(() => {
    tagDB.loadDB()

    // console.log('MXIV::Main process broadcast: tag sync')
    BrowserWindow.getAllWindows().forEach(win => {
      win.send('tags:sync')
    })
  })
  console.log('MXIV: Monitoring tag file changes.')
}


/**
 * Initialize tag controller, file monitoring in main process.
 * Send sync requests to renderer instances on detected changes.
 */
initialize()


module.exports = { tagFile, untagFile, listOrphans }