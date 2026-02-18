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
  return await tagStorage.write(state => {
    const oldSet = new Set( state.get(filePath) );
    const tagSet = new Set(tags);
    const newSet = oldSet.union(tagSet);

    if (oldSet.size != newSet.size) 
      state.set(filePath, [...newSet]);
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
  return await tagStorage.write(state => {
    const oldSet = new Set( state.get(filePath) );
    const tagSet = new Set(tags);
    const newSet = oldSet.difference(tagSet);

    // save to storage
    if (oldSet.size != newSet.size)
      state.set(filePath, [...newSet]);
    else
      throw 'rollback';
  });
}

/**
 * Rename all occurences of one or more tags.
 * @param {string[]} tags Tags to rename.
 * @returns {Promise<number>} Entries updated.
 */
export async function renameTags(...tags) {
  const target = /** @type {string} */ (tags.pop());
  const renameMap = new Map( tags.map(tag => [tag, target]) );

  let entriesUpdated = 0;
  await tagStorage.write(state => {
    entriesUpdated = state.renameTags(renameMap);

    if (entriesUpdated < 1)
      throw 'rollback';
  });

  return entriesUpdated;
}

/**
 * Delete all occurences of one or more tags.
 * @param {string[]} tags Tags to delete.
 * @returns {Promise<number>} Entries updated.
 */
export async function deleteTags(...tags) {
  let entriesUpdated = 0;
  await tagStorage.write(state => {
    entriesUpdated = state.deleteTags(tags);

    if (entriesUpdated < 1)
      throw 'rollback';
  });

  return entriesUpdated;
}

/**
 * Return amount entries whose files are no longer accessible.
 * @param {boolean} [deleteOrphans=false] Either to delete orphans entries if found.
 * @returns {Promise<number>} Orphaned entry count.
 */
export async function countOrphans(deleteOrphans = false) {
  const orphans = await tagStorage.listOrphans(deleteOrphans);
  return orphans.length;
}

/**
 * Monitor tagStorage file and broadcast sync requests 
 * to renderer instances on detected changes.
 */
async function initialize() {
  tagStorage.watchStorage(() => {
    broadcast('tags:sync');
  });

  console.log('MXIV: Monitoring TagStorage file changes.');
}


initialize();
