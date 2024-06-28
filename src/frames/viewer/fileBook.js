/**
 * @typedef {import("../../APIs/file/fileSearch").FileObject} FileObject
 */

/**
 * @typedef {import("../../APIs/file/openFile").BookObject} BookObject
 */


/**
 * Load files and manage logical pagination state.
 */
export class FileBook {
  
  /** 
   * FileBook UUID
   * @type {String}
   */
  #bookID = crypto.randomUUID()

  /**
   * All files loaded.
   * @type {FileObject[]}
   */
  #allFiles = []
  
  /**
   * All files from current filter.
   * @type {FileObject[]}
   */
  #filterFiles = []
  
  /**
   * All loaded directory paths.
   * @type {FileObject[]}
   */
  paths = []

  /**
   * Current page index.
   * @type {Number}
   */
  page = 0

  #collator = new Intl.Collator('en', { numeric: true })
  

  /** 
   * Load files from given paths.
   * @param {String[]} paths Path to file or folder.
   * @returns {Promise<boolean>} Success.
   */
  async load(...paths) {
    console.time(`bookID#${this.#bookID} open`)

    /** @type {BookObject} */
    const book = await elecAPI.openFile(paths, this.#bookID)

    if (book.paths.length < 1) {
      console.timeEnd(`bookID#${this.#bookID} open`)
      return false
    }

    this.paths = book.paths
    this.#allFiles = book.files

    // sort all files by path. (use name if to ignore directory order)
    this.#allFiles.sort( (fileA, fileB) =>
      this.#collator.compare(fileA.path, fileB.path)
    )

    // trigger new fetchs for previously cached resources 
    // that were possibly renamed, edited or overwritten
    elecAPI.clearCache();

    // reset related state properties
    if (this.#filterFiles.length) 
      this.clearFilter()

    // first file unless startOn defined and reachable
    let startIdx = 0
    if (book.startOn != null) {
      const match = book.startOn.toLowerCase()
      startIdx = this.getIdxOf(file => file.path.toLowerCase().includes(match) )
    }
    this.page = Math.max(0, startIdx)

    console.timeEnd(`bookID#${this.#bookID} open`)
    return true
  }

  /**
   * Clear temporary folders created for this book, if any.
   */
  closeBook() {
    elecAPI.clearTmp(this.#bookID)
  }

  /**
   * All visible files in current state.
   * @returns {FileObject[]}
   */
  get files() {
    return this.#filterFiles.length > 0 ? this.#filterFiles : this.#allFiles
  }

  /**
   * Get FileObject from current page index.
   * @returns {FileObject?}
   */
  get currentFile() {
    return this.files[this.page]
  }

  /**
   * Filter files and update page index. Abort if no files match the filter.
   * @param {(file:FileObject)=>Boolean} predicate Filter function.
   * @returns {Number} New file count. `0` for no matches.
   */
  filter(predicate) {
    const currentFile = this.files[this.page]

    const filterFiles = this.#allFiles.filter( file => predicate(file) )
    if (filterFiles.length > 0) {
      this.#filterFiles = filterFiles

      const newIdx = this.getIdxOf(file => file.path === currentFile.path)
      this.page = newIdx < 0 ? Math.min(this.page, this.files.length - 1) : newIdx
    }

    return filterFiles.length
  }

  /**
   * Clear active filter.
   */
  clearFilter() {
    const currentFile = this.files[this.page]
    this.#filterFiles = []
    this.page = this.getIdxOf(file => file.path === currentFile.path)
  }

  /**
   * Filter files by partial word queries and tags and update page index.
   * @param {String[]} queries Words to look for.
   * @returns {number} New file count. `0` for no matches.
   */
  filterStringAndTags(...queries) {
    queries = queries.map( query => query.toLowerCase().trim() )
      .filter(query => query !== '') // treat queries

    // if exclusive, require match for all strings
    const exclusive = queries.includes('--exclusive')
    const workingQuery = queries.filter(query => !query.includes('--exclusive'))

    return this.filter(file => {
      const path = file.path.toLowerCase()
      const fileTags = elecAPI.getTags(file.path)
      
      // match on substring in path or for whole tags
      let match = false
      for (const str of workingQuery) {
        match = path.includes(str) || fileTags.includes(str)
        if (!exclusive && match) break
				if (exclusive && !match) break
      }

      return match
    })
  }

  /**
   * Add and remove tags for current file.
   * @param {Boolean} [add=true] Add tags instead of removing them.
   * @param {String[]} tags Tags to associate to current file.
   * @returns {Promise<Boolean>} Either any tags where updated.
   */
  async tag(add = true, ...tags) {
    tags = tags.map(tag => tag.toLocaleLowerCase().trim())
      .filter(tag => tag) // filter invalid tags

    const currentFile = this.files[this.page]
    if (!currentFile || !tags.length) return false

    let success
    if (add) success = await elecAPI.addTags(currentFile.path, ...tags)
    else success = await elecAPI.removeTags(currentFile.path, ...tags)

    return success
  }

  /** 
   * Set page index while wrapping around if out-of-bound.
   * @param {Number} pageIdx New page index.
   * @returns {FileObject?} Normalized index FileObject.
   */
  setPageIdx(pageIdx) {
    const pageLength = this.files.length
    if (!pageLength) return null

    let newPage = (pageIdx >= pageLength) ? 0 : pageIdx
    if (pageIdx < 0) newPage = pageLength -1

    this.page = newPage
    return this.files[newPage]
  }

  /**
   * Set page to a random index.
   */
  setRandomPageIdx() {
    const fileCount = this.files.length
    const randomIdx = Math.round( Math.random() * fileCount )
    
    // flip if ~2 files, re-roll if randomIdx === current page
    if (fileCount < 3) 
      this.setPageIdx(this.page + 1)
    else if (randomIdx === this.page) 
      this.setRandomPageIdx()
    else
      this.page = randomIdx
  }

  /** 
   * Returns index of first file whose predicate is true. 
   * - Searches from following page, then from the start if not found. 
   * @param {(file:FileObject)=>boolean} predicate Substrings to search for.
   * @returns {Number} Index position. `-1` if unmatched.
   */
  getIdxOf(predicate) {
    // search from next page till end of array
    for (let i = this.page + 1; i < this.files.length; i++) {
      const file = this.files[i]
      if ( predicate(file) ) return i
    }

    // search from beginning till current page (+filter condition check)
    for (let i = 0; i < this.page + 1 && i < this.files.length; i++) {
      const file = this.files[i]
      if ( predicate(file) ) return i
    }

    return -1
  }

  /**
   * Delist file from inner listings and update page index if necessary.
   * @param {FileObject} file FileBook object.
   */
  delistFile(file) {
    const targetIdx = this.#allFiles.indexOf(file);
    if (targetIdx < 0) return;

    const currentFile = this.currentFile;
    const filterActive = this.#filterFiles.length > 0;
    const targetIsCurrentFile = this.#allFiles[targetIdx] === currentFile;
    
    this.#allFiles.splice(targetIdx, 1);
    
    if (filterActive) {
      const targetFilterIdx = this.#filterFiles.indexOf(file);
      if (targetFilterIdx > -1) this.#filterFiles.splice(targetFilterIdx, 1);
    }

    if (targetIsCurrentFile)
      this.setPageIdx( Math.min(this.page, this.files.length - 1) );
    else if (currentFile != null)
      this.page = this.files.indexOf(currentFile);
  }
}
