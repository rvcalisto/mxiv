/**
 * Open and manage media file operations.
 */
export class FileBook {
  
  static #lastBookID = 0

  /** @type {import("../../APIs/fileAPI").FileObject[]} */
  #allFiles = []
  
  /** @type {import("../../APIs/fileAPI").FileObject[]} */
  #filterFiles = []

  /** @type {String[]} Filter strings applied. */
  #filterQuery = []
  
  constructor() {

    /** @type {Number} FileBook UID */
    this.bookID = ++FileBook.#lastBookID

    this.page = 0

    /** @type {import("../../APIs/fileAPI").FileObject[]} All paths loaded. */
    this.paths = []
  }

  /** 
   * Load files from given paths. Returns first file index on success.
   * @param {String} paths Path to file or folder.
   * @returns {Promise<Number>} Starting file idx. -1 on failure.
   */
  async load(...paths) {
    console.time(`bookID#${this.bookID} open`)

    /** @type {import("../../APIs/openAPI").BookObject} */
    const bookObj = await elecAPI.open(paths, this.bookID)
    
    // no valid paths, fail
    if (!bookObj.paths.length) {
      console.timeEnd(`bookID#${this.bookID} open`)
      return -1
    }

    // else, store loaded paths
    const startOn = bookObj.startOn
    this.paths = bookObj.paths
    this.#allFiles = bookObj.files

    // sort all files by path. (use name if to ignore directory order)
    const coll = new Intl.Collator('en', {numeric: true})
    this.#allFiles.sort((fileA, fileB) =>
      coll.compare(fileA.path, fileB.path)
    )

    // clear cache to trigger new fetch for previously loaded 
    // paths. For when files are renamed, edited or overwritten.
    elecAPI.clearCache();

    // reset related state properties
    if (this.#filterFiles.length) this.#buildFilter()
    this.page = 0

    // first file unless startOn defined and reachable
    let startIdx = startOn ? this.getIdxOf(startOn) : 0
    startIdx = Math.max(0, startIdx)

    console.timeEnd(`bookID#${this.bookID} open`)
    return startIdx
  }

  /**
   * Clear temporary folders created for this book, if any.
   */
  closeBook() {
    elecAPI.clearTmp(this.bookID)
  }

  /**
   * Files in book.
   * @returns {import("../../APIs/fileAPI").FileObject[]}
   */
  get files() {
    return this.#filterQuery.length ? this.#filterFiles : this.#allFiles
  }

  /**
   * @returns {import("../../APIs/fileAPI").FileObject}
   */
  get currentFile() {
    return this.files[this.page]
  }

  /**
   * Build filter files and update page. Clear filter if called without args. 
   * Returns generated filterFiles array count. -1 on failure.
   * @param {String[]} query To display.
   * @param {(file:import("../../APIs/fileAPI").FileObject)=>Boolean} filter 
   * Filter function. Must return boolean.
   * @returns {Number}
   */
  #buildFilter(query = [], filter) {
    const currentFile = this.files[this.page]

    if (!query.length || !filter) {
      this.#filterFiles = []
      this.#filterQuery = []
      this.page = this.getIdxOf(currentFile.path)
      
      return -1
    }
  
    const filterFiles = this.#allFiles.filter( file => filter(file) )
    if (filterFiles.length) {
      this.#filterFiles = filterFiles
      this.#filterQuery = query
      this.page = this.getIdxOf(currentFile.path)

			return filterFiles.length
    }

    return 0
  }

  /**
   * Apply filter on files paths and tags.
   * Clear filter when called with no arguments.
   * @param {String[]} queries
   * @returns {number} Number of files after filter. `-1` on filter clear. `0` for no changes.
   */
  filter(...queries) {

    // treat queries
    queries = queries.map(query => query.toLowerCase().trim())
    .filter(query => query)

    // if exclusive, require match for all strings
    const exclusive = queries.includes('--exclusive')
    const workingQuery = queries.filter(query => !query.includes('--exclusive'))

    const filteredCount = this.#buildFilter(queries, (file) => {
      const path = file.path.toLowerCase()
      const fileTags = elecAPI.tagAPI.getTags(file.path)
      
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
   * @param  {...String} tags Tags to associate to current file.
   * @returns {Boolean} Either any tags where updated.
   */
  async tag(add = true, ...tags) {

    // filter invalid tags
    tags = tags.map(tag => tag.toLocaleLowerCase().trim()).filter(tag => tag)

    const currentFile = this.files[this.page]
    if (!currentFile || !tags.length) return false

    let success
    if (add) success = await elecAPI.tagAPI.tagFile(currentFile.path, ...tags)
    else success = await elecAPI.tagAPI.untagFile(currentFile.path, ...tags)

    return success
  }

  /** 
   * Set current page. Wrap around if index is out-of-bound.
   * @param {Number} pageIdx Normalized index FileObject.
   * @returns {import("../../APIs/fileAPI").FileObject} 
   */
  setPageIdx(pageIdx) {
    // drop process if no pages or loading previous request
    const pageLength = this.files.length
    if (!pageLength) return

    // outbounds? wrap around
    let newPage = (pageIdx >= pageLength) ? 0 : pageIdx
    if (pageIdx < 0) newPage = pageLength -1

    this.page = newPage
    return this.files[newPage]
  }

  /** 
   * Returns index of first file whose path includes query. 
   * Begins from the next page, then from the start if not found. 
   * Returns -1 if not in array. Also used in fileExplorer
   * @param {String[]} queries Substring to search for.
   * @returns {Number} Match index position. -1 if unmatched.
   */
  getIdxOf(...queries) {
    // treat arguments, exit early if not valid
    queries = queries.map(query => query.trim().toLowerCase())
    .filter(query => query !== '')
    if (!queries.length) return -1
    
    // start from next page, else from beggining
    for (const start of [this.page + 1, 0]) {
      const foundIndex = this.files.findIndex((file, idx) => {
        if (idx < start) return false

        const filePath = file.path.toLowerCase()
        for (const query of queries) {
          if (filePath.includes(query)) return true
        }
      })

      // found match, break loop
      if (foundIndex > -1) return foundIndex
    }

    return -1
  }

  /**
   * remove file from files and filter arrays
   * @param {import("../../APIs/fileAPI").FileObject} file FileBook.files array item.
   * @returns {Number} New order equivalent idx sugestion. -1 if not found.
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

    // return new order equivalent idx as a sugestion 
    const lastPageIdx = this.files.length -1
    return pageIdx >= lastPageIdx ? lastPageIdx : pageIdx
  }

  /**
   * @returns {String[]}
   */
  get filterQuery() {
    return this.#filterQuery
  }
}