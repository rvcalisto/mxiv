const { platform, env } = require('process');
const { homedir } = require('os');
const { join, isAbsolute } = require('path');
const fs = require('fs');


// XDG compliant base
const dataHome = platform === 'win32' ?
  /** @type {string} */ (env.LOCALAPPDATA) :
  isAbsolute(env.XDG_DATA_HOME || '') && env.XDG_DATA_HOME || 
  join( homedir() , '.local/share' );


/**
 * MXIV tag file absolute path.
 */
const tagDBFile = join(dataHome, 'mxiv', 'tagDB.json');

/**
 * MXIV library file absolute path.
 */
const libraryFile = join(dataHome, 'mxiv', 'library.json');

/**
 * MXIV library cover directory absolute path.
 */
const libraryCoverDirectory = join(dataHome, 'mxiv', 'covers');


/**
 * Recursively create MXIV base data directory.
 */
async function initializeBase() {
  await migrateOldData();
  fs.mkdirSync( join(dataHome, 'mxiv') , { recursive: true });
}

/**
 * Migrate existing old MXIV data folder as long as there is no new in place.
 * - TODO: Remove later.
 */
async function migrateOldData() {
  if (platform === 'win32')
    return; // no migration needed on Windowns

  const newDataPath = join(dataHome, 'mxiv');
  const oldDataPath = join( homedir() , '.cache', 'mxiv' );
  const hasNewData = fs.existsSync(newDataPath);

  if ( !hasNewData && fs.existsSync(oldDataPath) ) {
    fs.mkdirSync(dataHome, { recursive: true });
    fs.renameSync(oldDataPath, newDataPath);

    // update 'coverPath', 'coverURL' for library entries
    const { libraryStorage } = await import('../library/libraryStorage.js');
    const state = await libraryStorage.getState()
      .catch(() => {}); // no storage file to migrate

    if (state != null) {
      for (const [key, value] of state) {
        const coverPath = value.coverPath.replace(oldDataPath, newDataPath);
        state.setFromCover(key, coverPath);
      };

      libraryStorage.setState(state);
    }
    
    console.log(`MXIV: Migrated "${oldDataPath}" to "${newDataPath}".`);
  }
}


module.exports = { tagDBFile, libraryFile, libraryCoverDirectory, initializeBase }
