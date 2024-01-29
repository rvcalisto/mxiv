const p = require('path');
const { JsonStorage } = require('../tool/jsonStorage');
const { homedir } = require('os');


/**
 * Library persistent storage filepath.
 */
const storageFile = process.platform === 'win32' ?
  p.join(process.env.LOCALAPPDATA, 'mxiv', 'library.json') :
  p.join(homedir(), '.cache', 'mxiv', 'library.json')


/**
 * New library entry storage method.
 */
const newLibrary = new JsonStorage(storageFile)


/**
 * Migrate existing library entry object from localStorage to JsonStorage.
 * TODO: Remove, some commits later.
 */
newLibrary.getPersistence().catch(async error => {
  const oldLibrary = JSON.parse( localStorage.getItem('libraryPaths') )

  if (oldLibrary != null) {
    console.log(`Library migration: Found localStorage, creating JSON file.`)
    newLibrary.storageObject = oldLibrary
    
    await newLibrary.persist()
      .then( () => console.log(`Library migration: Created JSON file. Completed.`) )
      .catch( () => console.log(`Library migration: Failed to create JSON file.`) )
  }
})