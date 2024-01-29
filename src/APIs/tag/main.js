const path = require('path');
const { mkdir } = require('fs');
const { TagStorage } = require('./tagStorage');
const { BrowserWindow } = require('electron');


/**
 * Tag Storage to atomically transact with in main process.
 */
const tagStorage = new TagStorage()


/**
 * Add tags to entry and save changes to storage.
 * @param {String} filePath 
 * @param {String[]} tags
 * @returns {Promise<Boolean>}
 */
async function tagFile(filePath, ...tags) {
  // sync before
  await tagStorage.getPersistence()

  let tagsAdded = 0
  const newTags = tagStorage.getTags(filePath)
  
  // don't add duplicates
  for (const tag of tags) {
    if ( newTags.includes(tag) ) continue
    newTags.push(tag)
    tagsAdded++
  }

  // save to storage
  tagStorage.setTags(filePath, newTags)
  if (tagsAdded) return await tagStorage.persist()
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
  await tagStorage.getPersistence()

  let tagsRemoved = 0
  const newTags = tagStorage.getTags(filePath)
  if (newTags.length === 0) return false
  
  for (const tag of tags) {
    const idx = newTags.indexOf(tag)
    if (idx > -1) {
      newTags.splice(idx, 1)
      tagsRemoved++
    }
  }

  // save to storage
  tagStorage.setTags(filePath, newTags)
  if (tagsRemoved) return await tagStorage.persist()
  else return false
}

/**
 * List database entries whose files are no longer accessible.
 * @param {false} deleteOrphans Either to delete orphans entries if found.
 */
async function listOrphans(deleteOrphans = false) {
  await tagStorage.listOrphans(deleteOrphans)
}

/**
 * Recursively create storage file if not already created.
 * @returns {Promise<boolean>} Success.
 */
async function createTagStorageFile() {
  const storageDirectory = path.dirname(tagStorage.storageFile)

  return await new Promise(resolve => {
    mkdir( storageDirectory, { recursive: true }, async (err) => {
      if (err) {
        console.log('MXIV: Failed to create storage directory.\n', err)
      } else {
        await tagStorage.persist()
        console.log('MXIV: Created tag JSON storage at:', tagStorage.storageFile) 
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
  const success = await tagStorage.getPersistence()
  if (!success) {
    console.log('MXIV: Tag storage file not found. Creating...') 
    if ( !await createTagStorageFile() ) return
  }

  tagStorage.monitorPersistenceFile(() => {
    tagStorage.getPersistence()

    // console.log('MXIV::Main process broadcast: tag sync')
    BrowserWindow.getAllWindows().forEach(win => {
      win.send('tags:sync')
    })
  })
  console.log('MXIV: Monitoring tag persistence file.')
}


/**
 * Initialize tag controller, file monitoring in main process.
 * Send sync requests to renderer instances on detected changes.
 */
initialize()


module.exports = { tagFile, untagFile, listOrphans }