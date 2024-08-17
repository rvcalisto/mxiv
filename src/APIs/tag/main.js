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
  return await tagStorage.write(db => {
    const oldSet = new Set( db.get(filePath) );
    const tagSet = new Set(tags);
    const newSet = oldSet.union(tagSet);

    if (oldSet.size != newSet.size) 
      db.set(filePath, [...newSet]);
    else
      throw 'rollback'; // don't persist
  });
}

/**
 * Remove tags from entry and save changes to storage.
 * @param {String} filePath 
 * @param {String[]} tags
 * @returns {Promise<Boolean>}
 */
async function untagFile(filePath, ...tags) {
  return await tagStorage.write(db => {
    const oldSet = new Set( db.get(filePath) );
    const tagSet = new Set(tags);
    const newSet = oldSet.difference(tagSet);
  
    // save to storage
    if (oldSet.size != newSet.size)
      db.set(filePath, [...newSet]);
    else
      throw 'rollback';
  });
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
  const uninitialized = await tagStorage.getState()
    .then(() => false)
    .catch(() => true);
  
  if (uninitialized) {
    const error = await tagStorage.setState( new Map() )
      .then(() => { console.log('MXIV: Initialized TagStorage.') } )
      .catch(() => true);

    if (error)
      return console.error(`MXIV: Failed to initialize TagStorage.`)
  }

  tagStorage.watchStorage(() => {
    broadcast('tags:sync');
  })
  
  console.log('MXIV: Monitoring TagStorage file changes.')
}


initialize()


module.exports = { tagFile, untagFile, listOrphans }
