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
newLibrary.getPersistence().then(async gotPersistence => {
  const oldLibrary = JSON.parse( localStorage.getItem('libraryPaths') )

  if (!gotPersistence && oldLibrary != null) {
    newLibrary.storageObject = oldLibrary
    const migrated = await newLibrary.persist()
    console.log(`library migration: ${migrated ? 'OK' : 'NOK'}`)
  }
})