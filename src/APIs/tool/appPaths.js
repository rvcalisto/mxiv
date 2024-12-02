import { platform, env } from 'process';
import { homedir } from 'os';
import { join, isAbsolute } from 'path';
import fs from 'fs';


// XDG compliant base
const dataHome = platform === 'win32' ?
  /** @type {string} */ (env.LOCALAPPDATA) :
  isAbsolute(env.XDG_DATA_HOME || '') && env.XDG_DATA_HOME || 
  join( homedir() , '.local/share' );


/**
 * MXIV tag file absolute path.
 */
export const tagDBFile = join(dataHome, 'mxiv', 'tagDB.json');

/**
 * MXIV library file absolute path.
 */
export const libraryFile = join(dataHome, 'mxiv', 'library.json');

/**
 * MXIV library cover directory absolute path.
 */
export const libraryCoverDirectory = join(dataHome, 'mxiv', 'covers');


/**
 * Recursively create MXIV base data directory.
 */
export async function initializeBase() {
  fs.mkdirSync( join(dataHome, 'mxiv') , { recursive: true });
}
