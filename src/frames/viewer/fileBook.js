// @ts-check
import { matchNameOrTags } from '../../components/fileMethods.js';


/**
 * @import { FileObject } from "../../APIs/file/fileSearch"
 * @import { BookObject } from "../../APIs/file/openFile"
 */


/**
 * Load files and manage logical pagination state.
 */
export class FileBook {

  /** 
   * FileBook UUID.
   */
  #bookID = crypto.randomUUID();

  /**
   * All files loaded.
   * @type {FileObject[]}
   */
  #allFiles = [];

  /**
   * All files from current filter.
   * @type {FileObject[]}
   */
  #filterFiles = [];

  /**
   * All loaded directory paths.
   * @type {FileObject[]}
   */
  #paths = [];

  /**
   * Current page index.
   */
  #pageIdx = 0;

  #collator = new Intl.Collator('en', { numeric: true });
  

  /** 
   * Load files from paths and clear applied filters on success.
   * @param {string[]} paths Path to file or folder.
   * @returns {Promise<boolean>} Success.
   */
  async load(...paths) {
    console.time(`bookID#${this.#bookID} open`);

    /** @type {BookObject} */
    const book = await elecAPI.openFile(paths, this.#bookID);

    if (book.paths.length < 1) {
      console.timeEnd(`bookID#${this.#bookID} open`);
      return false;
    }

    this.#paths = book.paths;
    this.#allFiles = book.files;

    // sort all files by path. (use name if to ignore directory order)
    this.#allFiles.sort( (fileA, fileB) =>
      this.#collator.compare(fileA.path, fileB.path)
    );

    // trigger new fetchs for previously cached resources 
    // that were possibly renamed, edited or overwritten
    elecAPI.clearCache();

    // reset related state properties
    if ( this.isFiltered() )
      this.clearFilter();

    // first file unless startOn defined and reachable
    let startIdx = 0;
    if (book.startOn != null) {
      const match = book.startOn.toLowerCase();
      startIdx = this.files.findIndex( file => file.path.toLowerCase().includes(match) );
    }

    this.#pageIdx = Math.max(0, startIdx);
    console.timeEnd(`bookID#${this.#bookID} open`);

    return true;
  }

  /**
   * Clear temporary folders created for this book, if any.
   */
  closeBook() {
    elecAPI.clearTmp(this.#bookID);
  }

  /**
   * All visible files in current state.
   * @returns {FileObject[]}
   */
  get files() {
    return this.isFiltered()
      ? this.#filterFiles
      : this.#allFiles;
  }

  /**
   * Current page index.
   */
  get page() {
    return this.#pageIdx;
  }

  /**
   * Currently loaded directory paths.
   */
  get paths() {
    return this.#paths;
  }

  /**
   * Get FileObject from current page index.
   * @returns {FileObject?}
   */
  get currentFile() {
    return this.files[this.#pageIdx];
  }

  /**
   * Either files are currently under a filter.
   * @returns {boolean}
   */
  isFiltered() {
    return this.#filterFiles.length > 0;
  }

  /**
   * Filter files and update page index. Abort if no files match the filter.
   * @param {(file:FileObject)=>boolean} predicate Filter function.
   * @returns {number} New file count. `0` for no matches.
   */
  filter(predicate) {
    const currentFile = this.files[this.#pageIdx];
    const filterFiles = this.#allFiles.filter( file => predicate(file) );

    if (filterFiles.length > 0) {
      this.#filterFiles = filterFiles;
      const newIdx = this.#filterFiles.indexOf(currentFile);

      this.#pageIdx = newIdx < 0
        ? Math.min(this.#pageIdx, this.files.length - 1)
        : newIdx;
    }

    return filterFiles.length;
  }

  /**
   * Clear active filter and update page index.
   */
  clearFilter() {
    const currentFile = this.files[this.#pageIdx];
    this.#filterFiles = [];
    this.#pageIdx = this.#allFiles.indexOf(currentFile);
  }

  /**
   * Filter files by partial word queries and tags and update page index.
   * @param {string[]} queries Words to look for.
   * @returns {number} New file count. `0` for no matches.
   */
  filterStringAndTags(...queries) {
    const treatedQueries = queries
      .map( query => query.toLowerCase().trim() )
      .filter(query => query !== '');

    return this.filter( (file) => matchNameOrTags(file, treatedQueries) );
  }

  /** 
   * Set page index while wrapping around if out-of-bound.
   * @param {number} pageIdx New page index.
   * @returns {FileObject?} Normalized index FileObject.
   */
  setPageIdx(pageIdx) {
    const fileCount = this.files.length;
    if (fileCount < 1)
      return null;

    this.#pageIdx = pageIdx >= 0
      ? pageIdx % fileCount
      : fileCount - 1;

    return this.files[this.#pageIdx];
  }

  /**
   * Set page to a random index.
   */
  setRandomPageIdx() {
    const fileCount = this.files.length;
    const randomIdx = Math.round( Math.random() * fileCount );

    if (fileCount < 3)
      this.setPageIdx(this.#pageIdx + 1); // flip-wrap
    else if (randomIdx === this.#pageIdx) 
      this.setRandomPageIdx(); // re-roll
    else
      this.#pageIdx = randomIdx;
  }

  /**
   * Delist file from inner listings and update page index if necessary.
   * - Clear any active filter if target is the sole element.
   * @param {FileObject} file FileBook object.
   */
  delistFile(file) {
    const targetIdx = this.#allFiles.indexOf(file);
    if (targetIdx < 0)
      return;

    const currentFile = this.files[this.#pageIdx];
    const targetIsCurrentFile = this.#allFiles[targetIdx] === currentFile;

    this.#allFiles.splice(targetIdx, 1);

    // delist from #filterFiles, clear filter if empty 
    if ( this.isFiltered() ) {
      const targetFilterIdx = this.#filterFiles.indexOf(file);

      if (targetFilterIdx > -1)
        this.#filterFiles.splice(targetFilterIdx, 1);

      if (this.#filterFiles.length < 1)
        this.clearFilter();
    }

    if (targetIsCurrentFile)
      this.setPageIdx( Math.min(this.#pageIdx, this.files.length - 1) );
    else
      this.#pageIdx = this.files.indexOf(currentFile);
  }
}
