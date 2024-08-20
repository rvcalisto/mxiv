// @ts-check
const fs = require('fs');


/**
 * Persistent JSON storage.
 * @template T
 * @template {Map<string, T>} [W=Map<string, T>]
 */
class JsonStorage {

  /**
   * Persistent JSON filepath.
   */
  #storageFile = '';

  /**
   * As fs.watch runs the callback twice on every single file write, 
   * track the number of calls and only process when it's even.
   */
  #watchCount = 0;

  /**
   * Last read storage file modified-time.
   * @type {Number|undefined}
   */
  #lastReadTime;

  /**
   * Last sync'd storage file JSON text.
   */
  #cachedStateJSON = '{}';

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
   * Initialize storage instance.
   * @param {string} storageFile Persistent JSON storage filepath.
   * @param {Wrapper} [wrapper=Map] Custom state wrapper class.
   */
  constructor(storageFile, wrapper) {
    this.#storageFile = storageFile;

    // @ts-ignore (TS psychobabble)
    this.#wrapper = wrapper || Map;
  }

  /**
   * Returns storage file last modified-time. Null if file inaccessible.
   * @returns {Promise<Number?>}
   */
  async getLastModified() {
    return await new Promise(resolve => {
      fs.stat( this.#storageFile, (err, stats) => resolve(stats?.mtimeMs) );
    });
  }

  /**
   * Returns state snapshot from current storage file. Reject on error.
   * - Can be used to test read-access to storage file.
   * @param {boolean} [ignoreException=false] Suppress exception, return snapshot. False by default.
   * @throws {PromiseRejectionEvent} On failure.
   * @returns {Promise<W>} State snapshot.
   */
  async getState(ignoreException = false) {
    const modifiedTime = await this.getLastModified() || Date.now();

    if (modifiedTime !== this.#lastReadTime) {
      this.#cachedStateJSON = await new Promise((resolve, reject) => {
        fs.readFile(this.#storageFile, 'utf8', async (err, text) => {
          if (err) {
            ignoreException ? resolve(this.#cachedStateJSON) : reject(err);
          } else {
            this.#lastReadTime = modifiedTime;
            resolve(text);
          }
        });
      });
    }

    const storageObject = JSON.parse(this.#cachedStateJSON);
    return new this.#wrapper( Object.entries(storageObject) );
  }

  /**
   * Persist state snapshot to storage file. Reject on error.
   * - Can be used to test write-access to storage file.
   * @param {Map<string, T>} state State snapshot to persist.
   * @throws {PromiseRejectionEvent} On failure.
   * @returns {Promise<void>}
   */
  async setState(state) {
    // get object from native class iterator, hopefully not overridden 
    const storageObject = Object.fromEntries(state);
    const json = JSON.stringify(storageObject);

    return await new Promise((resolve, reject) => {
      fs.writeFile(this.#storageFile, json, 'utf8', async (err) => {
        if (err) {
          reject(err);
        } else {
          this.#cachedStateJSON = json;
          this.#lastReadTime = await this.getLastModified() || Date.now();
          resolve();
        }
      });
    });
  }

  /**
   * Run transaction on fresh state, persist changes if no exception thrown.
   * @param {(state: W) => void|Promise<void>} transaction Transaction.
   * @returns {Promise<boolean>} Success.
   */
  async write(transaction) {
    const state = await this.getState(true);

    try {
      await transaction(state);
      await this.setState(state);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Watch storage file, run callback on detected changes. 
   * @param {()=>void} callback Callback function.
   */
  watchStorage(callback) {
    // watch triggers twice on write. Only process even counts
    fs.watch(this.#storageFile, () => {
      if (++this.#watchCount % 2 === 0)
        callback();
    });
  }
}


module.exports = { JsonStorage };
