// @ts-check
import { TagStorage, TagState } from './tagStorage.js';
import { ipcRenderer } from 'electron';


/**
 * Tag Storage to read-only in renderer process.
 */
const tagStorage = new TagStorage()

/**
 * Cached TagStoraged properties.
 * @type {{state: TagState, uniqueTags: string[]}}
 */
const cache = {
  state: new TagState(),
  uniqueTags: []
};


/**
 * Return file tags as an array.
 * @param {String} filePath Absolute path to file.
 * @returns {String[]}
 */
export function getTags(filePath) {
  return cache.state.get(filePath);
}

/**
 * Return unique tags.
 * @returns {String[]}
 */
export function uniqueTags() {
  return cache.uniqueTags;
}

/**
 * List database entries whose files are no longer accessible.
 */
export async function listOrphans() {
  await tagStorage.listOrphans(false);
}

/**
 * Refresh cache with up-to-date values.
 */
async function updateTagCache() {
  cache.state = await tagStorage.getState();
  cache.uniqueTags = cache.state.uniqueTags();
}

/**
 * Listen for main process tag controller sync requests.
 * Sync tag storage state to persistent JSON file.
 */
ipcRenderer.on('coord:onbroadcast', async (e, message) => {
  if (message === 'tags:sync') {
    updateTagCache();
    console.log('MXIV::broadcast: tags:sync');
  }
})


updateTagCache();
