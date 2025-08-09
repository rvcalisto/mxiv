// @ts-check
import { TagStorage } from './tagStorage.js';
import { broadcast } from '../tool/coordinationUtils.js';


/**
 * Tag Storage to handle renderer write requests in main process.
 */
const tagStorage = new TagStorage();


/**
 * Add tags to entry and save changes to storage.
 * @param {string} filePath 
 * @param {string[]} tags
 * @returns {Promise<boolean>}
 */
export async function tagFile(filePath, ...tags) {
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
 * @param {string} filePath 
 * @param {string[]} tags
 * @returns {Promise<boolean>}
 */
export async function untagFile(filePath, ...tags) {
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
 * @param {boolean} [deleteOrphans=false] Either to delete orphans entries if found.
 */
export async function listOrphans(deleteOrphans = false) {
  await tagStorage.listOrphans(deleteOrphans)
}

/**
 * Monitor tagStorage file and broadcast sync requests 
 * to renderer instances on detected changes.
 */
async function initialize() {
  tagStorage.watchStorage(() => {
    broadcast('tags:sync');
  })
  
  console.log('MXIV: Monitoring TagStorage file changes.')
}


initialize()
