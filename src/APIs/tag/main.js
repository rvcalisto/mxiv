const { TagStorage } = require('./tagStorage');
const { broadcast } = require('../tool/coordinationUtils');

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
  const newTags = tagStorage.get(filePath)
  
  // don't add duplicates
  for (const tag of tags) {
    if ( newTags.includes(tag) ) continue
    newTags.push(tag)
    tagsAdded++
  }

  // save to storage
  if (tagsAdded > 0) {
    tagStorage.set(filePath, newTags)
    await tagStorage.persist()
  }

  return tagsAdded > 0
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
  const newTags = tagStorage.get(filePath)
  if (newTags.length === 0) return false
  
  for (const tag of tags) {
    const idx = newTags.indexOf(tag)
    if (idx > -1) {
      newTags.splice(idx, 1)
      tagsRemoved++
    }
  }

  // save to storage
  if (tagsRemoved > 0) {
    tagStorage.set(filePath, newTags)
    await tagStorage.persist()
  }

  return tagsRemoved > 0
}

/**
 * List database entries whose files are no longer accessible.
 * @param {false} deleteOrphans Either to delete orphans entries if found.
 */
async function listOrphans(deleteOrphans = false) {
  await tagStorage.listOrphans(deleteOrphans)
}

/**
 * Initialize tagStorage, monitor, re-sync, and broadcast 
 * sync requests to renderer instances on detected storage changes.
 */
async function initialize() {
  const uninitialized = await tagStorage.getPersistence()
    .catch( () => true );
  
  if (uninitialized) {
    const error = await tagStorage.persist()
      .then( () => { console.log('MXIV: Initialized TagStorage.') } )
      .catch( () => true );

    if (error)
      return console.error(`MXIV: Failed to initialize TagStorage.`)
  }

  tagStorage.monitorPersistenceFile(() => {
    tagStorage.getPersistence()
    broadcast('tags:sync')
  })
  
  console.log('MXIV: Monitoring TagStorage file changes.')
}


initialize()


module.exports = { tagFile, untagFile, listOrphans }
