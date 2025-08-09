// @ts-check
import fs from 'fs';
import { parse, join } from 'path';


/**
 * Persistent JSON storage.
 * @template T
 * @template {Map<string, T>} [W=Map<string, T>]
 */
export class JsonStorage {

  /**
   * Persistent JSON filepath.
   */
  #storageFile = '';

  /**
   * Storage mutex lock filepath.
   */
  #lockFile = '';

  /**
   * Milliseconds to wait before retrying operations on lock.
   */
  #retryInterval = 50;

  /**
   * Last read storage-file modified-time.
   * @type {number|undefined}
   */
  #cachedModifiedTime;

  /**
   * Last read storage-file JSON text.
   */
  #cachedJsonText = '{}';

  /**
   * Storage state wrapper class.
   * @typedef {function(new:W, [string, T][])} Wrapper
   */

  /**
   * Storage state wrapper class.
   * @type {Wrapper}
   */
  #wrapper;

  /**
   * @typedef {(state: Map<string, T>) => any|Promise<any>} setStatePrepass
   */

  /**
   * Treat state snapshot before persisting it to file.
   * @type {setStatePrepass|undefined}
   */
  #setStatePrepass;

  /**
   * Initialize storage instance.
   * @param {string} storageFile Persistent JSON storage filepath.
   * @param {Wrapper} [wrapper=Map] Custom state wrapper class.
   * @param {setStatePrepass} [setStatePrepass] Function to run before persisting state.
   * @throws {TypeError} If storage filepath is empty.
   * @throws {Error} If storage file fails to be reached/initialized.
   */
  constructor(storageFile, wrapper, setStatePrepass) {
    if ( storageFile.trim().length < 1 )
      throw new TypeError('Storage filepath can\'t be empty');

    // create storage file, catch if already present, throw otherwise
    try {
      fs.writeFileSync(storageFile, '{}', { flag: 'wx' });
    } catch (error) {
      if (/** @type NodeJS.ErrnoException? */ (error)?.code !== 'EEXIST')
        throw new Error(`Failed to initialize storage file:\n${error}`);
    }

    const { dir, base } = parse(storageFile);
    this.#storageFile = storageFile;
    this.#lockFile = join(dir, `${base}.lock`);

    // @ts-ignore (TS psychobabble)
    this.#wrapper = wrapper || Map;
    this.#setStatePrepass = setStatePrepass;
  }

  /**
   * Check if storage file lock exists.
   * @returns {Promise<boolean>}
   */
  async #isLocked() {
    return await new Promise(resolve => {
      fs.access( this.#lockFile, (err) => resolve(err == null) );
    });
  }

  /**
   * Create storage file lock.
   * @returns {Promise<boolean>}
   */
  async #captureLock() {
    return await new Promise(resolve => {
      const options = { flag: 'wx' }; // fail if path already exists
      fs.writeFile( this.#lockFile, '', options, (err) => resolve(err == null) );
    });
  }

  /**
   * Delete storage file lock.
   * @throws {NodeJS.ErrnoException} If lock file survives. Not meant to be caught.
   */
  async #releaseLock() {
    const error = await new Promise(resolve => {
      fs.rm( this.#lockFile, (err) => resolve(err) );
    });

    // shouldn't happen, but make it known if it ever does
    if (error != null)
      throw new Error(`Failed to delete lock file at "${this.#lockFile}":\n${error}`);
  }

  /**
   * Wait some time until resolve.
   */
  async #retryDelay() {
    await new Promise(resolve => {
      setTimeout( () => resolve(true), this.#retryInterval );
    });
  }

  /**
   * Returns storage-file last-modified time. Null if file inaccessible.
   * @returns {Promise<number?>}
   */
  async getLastModified() {
    return await new Promise(resolve => {
      fs.stat( this.#storageFile, (_err, stats) => resolve(stats?.mtimeMs) );
    });
  }

  /**
   * Returns state snapshot from current storage file.
   * @throws {NodeJS.ErrnoException} If storage file is not readable.
   * @throws {SyntaxError} If storage file contains invalid JSON.
   * @returns {Promise<W>} State snapshot.
   */
  async #readState() {
    const modifiedTime = await this.getLastModified() || Date.now();
    let storageObject;

    if (modifiedTime === this.#cachedModifiedTime)
      storageObject = JSON.parse(this.#cachedJsonText)
    else {
      const jsonText = await new Promise((resolve, reject) => {
        fs.readFile(this.#storageFile, 'utf8', async (err, text) => {
          if (err)
            reject(err);
          else
            resolve(text);
        });
      });

      storageObject = JSON.parse(jsonText);
      this.#cachedJsonText = jsonText;
      this.#cachedModifiedTime = modifiedTime;
    }

    return new this.#wrapper( Object.entries(storageObject) );
  }

  /**
   * Returns state snapshot from current storage file.
   * @throws {NodeJS.ErrnoException} If storage file is not readable.
   * @throws {SyntaxError} If storage file contains invalid JSON.
   * @returns {Promise<W>} State snapshot.
   */
  async getState() {
    while ( await this.#isLocked() )
      await this.#retryDelay();

    return await this.#readState();
  }

  /**
   * Persist state snapshot to storage file.
   * @param {Map<string, T>} state State snapshot to persist.
   * @throws {NodeJS.ErrnoException} If file is not writable.
   * @returns {Promise<NodeJS.ErrnoException?>}
   */
  async #writeState(state) {
    if (this.#setStatePrepass != null)
      await this.#setStatePrepass(state);

    // get object from native class iterator, hopefully not overridden 
    const storageObject = Object.fromEntries(state);
    const json = JSON.stringify(storageObject);

    /**
     * @type {NodeJS.ErrnoException?}
     */
    return await new Promise(resolve => {
      fs.writeFile(this.#storageFile, json, 'utf8', async (err) => {
        if (err)
          resolve(err);
        else {
          this.#cachedJsonText = json;
          this.#cachedModifiedTime = await this.getLastModified() || Date.now();
          resolve(null);
        }
      });
    });
  }

  /**
   * Persist state snapshot to storage file.
   * @param {Map<string, T>} state State snapshot to persist.
   * @throws {NodeJS.ErrnoException} If file is not writable or lock not properly cleared.
   * @returns {Promise<void>}
   */
  async setState(state) {
    while ( !await this.#captureLock() )
      await this.#retryDelay();

    const error = await this.#writeState(state);

    // release lock before possibly throwing exception
    await this.#releaseLock();

    if (error != null)
      throw error;
  }

  /**
   * Run transaction on fresh state, persist changes if no exception thrown.
   * @param {(state: W) => any|Promise<any>} transaction Transaction.
   * @throws {NodeJS.ErrnoException} If lock not properly cleared.
   * @returns {Promise<boolean>} Success.
   */
  async write(transaction) {
    let result = true;

    while ( !await this.#captureLock() )
      await this.#retryDelay();

    try {
      const state = await this.#readState();
      await transaction(state);
      await this.#writeState(state);
    } catch {
      result = false;
    }

    await this.#releaseLock();

    return result;
  }

  /**
   * Watch storage file, run callback on detected changes.
   * - For large files, storage may be actively 
   *   being written to during callback execution.
   * @param {()=>any} callback Callback function.
   * @param {AbortSignal} [signal] Optional `AbortController` signal.
   */
  watchStorage(callback, signal) {
    // fs.watch runs the callback twice on every single file write, 
    // so track the call count and process only when it's even.
    let watchCalls = 0;

    fs.watch(this.#storageFile, { signal }, () => {
      if (++watchCalls === 2) {
        watchCalls = 0;
        callback();
      }
    });
  }
}
