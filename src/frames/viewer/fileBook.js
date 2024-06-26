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
   * Currently applied filter query.
   * @type {String[]}
   */
  #filterQuery = []

  #collator = new Intl.Collator('en', { numeric: true })
  
  constructor() {
    /**
     * All loaded paths.
     * @type {FileObject[]}
     */
    this.paths = []

    /**
     * Current page index.
     * @type {Number}
     */
    this.page = 0
  }

  /** 
   * Load files from given paths. Returns first file index on success.
   * @param {String[]} paths Path to file or folder.
   * @returns {Promise<Number>} Starting file idx. `-1` on failure.
   */
  async load(...paths) {
    console.time(`bookID#${this.#bookID} open`)

    /** @type {BookObject} */
    const book = await elecAPI.openFile(paths, this.#bookID)

    if (!book.paths.length) {
      console.timeEnd(`bookID#${this.#bookID} open`)
      return -1
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
    if (this.#filterFiles.length) this.#applyFilter()
    this.page = 0

    // first file unless startOn defined and reachable
    let startIdx = book.startOn ? this.getIdxOf(book.startOn) : 0
    startIdx = Math.max(0, startIdx)

    console.timeEnd(`bookID#${this.#bookID} open`)
    return startIdx
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
    return this.#filterQuery.length ? this.#filterFiles : this.#allFiles
  }

  /**
   * Get FileObject from current page index.
   * @returns {FileObject?}
   */
  get currentFile() {
    return this.files[this.page]
  }

  /**
   * Filter files and update page. Abort if no file passes, clear filter if called without args.
   * @param {String[]} query Filter keys to display.
   * @param {(file:FileObject)=>Boolean} [filterFunc] 
   * Filter function, must return boolean.
   * @returns {Number} Files in filter count. `0` on abort, `-1` on filter cleared.
   */
  #applyFilter(query = [], filterFunc) {
    const currentFile = this.files[this.page]

    if (!query.length || !filterFunc) {
      this.#filterFiles = []
      this.#filterQuery = []
      this.page = this.getIdxOf(currentFile.path)
      
      return -1
    }
  
    const filterFiles = this.#allFiles.filter( file => filterFunc(file) )
    if (filterFiles.length) {
      this.#filterFiles = filterFiles
      this.#filterQuery = query

      const newIdx = this.getIdxOf(currentFile.path)
      this.page = newIdx < 0 ? Math.max(0, this.page) : newIdx

			return filterFiles.length
    }

    return 0
  }

  /**
   * Apply filter on files paths and tags.
   * Clear filter when called with no arguments.
   * @param {String[]} queries
   * @returns {number} New file count. `0` for no matches. `-1` on filter clear.
   */
  filter(...queries) {
    queries = queries.map(query => query.toLowerCase().trim())
      .filter(query => query) // treat queries

    // if exclusive, require match for all strings
    const exclusive = queries.includes('--exclusive')
    const workingQuery = queries.filter(query => !query.includes('--exclusive'))

    const filteredCount = this.#applyFilter(queries, (file) => {
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

    return filteredCount
  }

  /**
   * Add and remove tags for current file.
   * @param {Boolean} add Add tags instead of removing them.
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
   * Set new page idx while wrapping around if out-of-bound.
   * @param {Number} pageIdx Normalized index FileObject.
   * @returns {FileObject?} 
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
   * Returns index of first file whose path includes query. 
   * - Searches from following page, then from the start if not found. 
   * @param {String[]} queries Substrings to search for.
   * @returns {Number} Index position. `-1` if unmatched.
   */
  getIdxOf(...queries) {
    queries = queries.map(query => query.trim().toLowerCase())
      .filter(query => query) // treat arguments
    if (!queries.length) return -1

    // search from next page till end of array
    for (let i = this.page + 1; i < this.files.length; i++) {
      const filePath = this.files[i].path.toLowerCase()
      for (const query of queries) {
        if ( filePath.includes(query) ) return i
      }
    }
    // search from beginning till current page (+filter condition check)
    for (let i = 0; i < this.page + 1 && i < this.files.length; i++) {
      const filePath = this.files[i].path.toLowerCase()
      for (const query of queries) {
        if ( filePath.includes(query) ) return i
      }
    }

    return -1
  }

  /**
   * Delist file from inner listings.
   * @param {FileObject} file FileBook object.
   * @returns {Number} Equivalent idx sugestion.`-1` if file to delist was not found.
   */
  delistFile(file) {
    const pageIdx = this.#allFiles.indexOf(file)
    if (pageIdx < 0) return -1

    this.#allFiles.splice(pageIdx, 1)

    // check if deleted page is in filter array, if it is, 
    // clear filter if only item, else rebuild
    let filterIdx = this.#filterFiles.indexOf(file)
    if (this.#filterFiles.length && filterIdx > -1) {
      if (this.#filterFiles.length < 2) this.filter()
      else this.filter(...this.#filterQuery)
    }

    const lastPageIdx = this.files.length -1
    return pageIdx >= lastPageIdx ? lastPageIdx : pageIdx
  }

  /**
   * Currently applied filter query. 
   * @returns {String[]}
   */
  get filterQuery() {
    return this.#filterQuery
  }
}