const os = require('os');
const path = require('path');
const { TagDBMS } = require('./tagDB');
const { mkdir } = require('fs');


const storageFile = process.platform === 'win32' ?
path.join(process.env.LOCALAPPDATA, 'mxiv', 'tagDB.json') :
path.join(os.homedir(), '.cache', 'mxiv', 'tagDB.json')

/** Tag database manager, singleton. */
const tagDB = new TagDBMS(storageFile)


/**
 * Add tags to entry and save changes to storage.
 * @param {String} filePath 
 * @param {...String} tags
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
 * @param {...String} tags
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
 * Return file tags as an array.
 * @param {String} filePath Absolute path to file.
 * @returns {String[]}
 */
function getTags(filePath) {
  return tagDB.getTags(filePath)
}

/**
 * Return unique tags.
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
 * @param {false} deleteOrphans Either to delete orphans entries if found.
 */
async function listOrphans(deleteOrphans = false) {
  tagDB.listOrphans(deleteOrphans)
}

/**
 * Load storage file and reload it when modified. 
 * If the file doesn't exist, try to create first.
 */
async function start() {

  const success = await tagDB.loadDB()
  if (!success) {
    console.log('Tag storage file not found. Creating...')

    mkdir( path.dirname(storageFile), { recursive: true }, async (err) => {
      if (err) return console.log('Failed to create storage directory.')
      await tagDB.storeDB()
    })
  }

  tagDB.reloadOnFileChange()
}


module.exports = { 
  start, tagFile, untagFile, getTags, uniqueTags, // app
  info, listOrphans // managing
}