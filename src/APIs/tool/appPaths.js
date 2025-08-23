// @ts-check
import { platform, env } from 'process';
import { homedir } from 'os';
import { join, isAbsolute } from 'path';
import { mkdirSync } from 'fs';


/**
 * XDG compliant base directory.
 */
const dataHome = platform === 'win32'
  ? /** @type {string} */ (env.LOCALAPPDATA)
  : isAbsolute(env.XDG_DATA_HOME ?? '') 
    ? /** @type {string} */ (env.XDG_DATA_HOME)
    : join( homedir() , '.local/share' );


/**
 * Absolute path to MXIV tag JSON file.
 */
export const tagDBFile = join(dataHome, 'mxiv', 'tagDB.json');

/**
 * Absolute path to MXIV library JSON file.
 */
export const libraryFile = join(dataHome, 'mxiv', 'library.json');

/**
 * Absolute path to MXIV library cover thumbnail directory.
 */
export const libraryCoverDirectory = join(dataHome, 'mxiv', 'covers');


/**
 * Create MXIV directory at data home if it doesn't exist.
 */
export function initializeDataDirectory() {
  mkdirSync( join(dataHome, 'mxiv') , { recursive: true } );
}
