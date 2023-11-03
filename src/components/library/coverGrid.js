import { ItemList } from "../../app/itemList.js"
import { Tab, FRAME } from "../../app/tabs.js";
import * as StatusBar from "../../app/statusBar.js"


/**
 * List covers and navigate them.
 */
export class CoverGrid {

  static #libraryStorage = 'libraryPaths'

  /** @type {import('../../APIs/libAPI.js'.LibraryObject)} */
  static #libraryCache = {}

  /** @type {String[]} */
  static #sortedLibraryKeys = []

  static dirtyCache = true

  /** @type {Cover?} */
  static selection = null

  /** @type {ItemList} */
  #list
  
  constructor(library) {
    this.#list = library.shadowRoot.getElementById('library')
    Cover.coverGrid = this
  }

  /**
   * Read and store library items and order in cache.
   */
  buildCache() {
    const localEntry = localStorage.getItem(CoverGrid.#libraryStorage)
    CoverGrid.#libraryCache = localEntry ? JSON.parse(localEntry) : {}
  
    // console.time('sort library')
    CoverGrid.#sortedLibraryKeys = Object.keys(CoverGrid.#libraryCache)
    const coll = new Intl.Collator('en', {numeric: true})
    CoverGrid.#sortedLibraryKeys.sort((pathA, pathB) => coll.compare(pathA, pathB)) 
    // console.timeEnd('sort library')
  
    CoverGrid.dirtyCache = false
    console.log('Library cache (re)built.');
  }

  /**
   * Draw covers whose path or tags includes query. Draws all if not given.
   * @param {String[]?} queries Filter covers.
   */
  drawCovers(queries) {
    if (CoverGrid.dirtyCache) this.buildCache()

    // all queries must match either path or a tag. Exclusive.
    const filterFunc = !queries ? undefined : (key) => {
      const bookObj = CoverGrid.#libraryCache[key]
      const bookTags = elecAPI.tagAPI.getTags(bookObj.path)
      const bookPath = bookObj.path.toLowerCase()

      for (let query of queries) {
        if (query[0] === '-') {
          // exclude tag query from results
          const match = bookTags.includes( query.slice(1) )
          if (match) return false
        } else {
          const match = bookPath.includes(query) || bookTags.includes(query)
          if (!match) return false
        }
      }

      return true
    }

    // console.time('populate library')
    this.#list.populate(CoverGrid.#sortedLibraryKeys, (key) => {
      const { name, path, coverPath, coverURL } = CoverGrid.#libraryCache[key]
      return Cover.from(name, path, coverPath, coverURL)
    }, filterFunc)
    // console.timeEnd('populate library')

    // recover last selection
    if (CoverGrid.selection) {
      const lastSelected = this.#list.findItemElement(item => item === CoverGrid.selection.bookPath)
      if (lastSelected) this.selectCover(lastSelected)
    }

    StatusBar.updateStatus()
  }

  /**
   * Number of covers listed.
   */
  get listedItemCount() {
    return this.#list.itemCount
  } 

  /**
   * Force build cache and draw covers.
   */
  reloadCovers() {
    CoverGrid.dirtyCache = true
    this.drawCovers()
  }

  selectCover(cover) {
    this.#list.selectIntoFocus(cover)
    CoverGrid.selection = cover
  }

  openCoverBook(newTab = false, keepOpen = false) {
    const selectedBook = CoverGrid.selection
    if (selectedBook) selectedBook.select(newTab, keepOpen)
  }

  nextCoverHorizontal(right = true) {
    const element = this.#list.navItems(right)
    if (element) this.selectCover(element)
  }

  nextCoverVertical(down = true) {
    const grid = this.#list.currentPageDiv
    if (!grid) return // empty #list

    // big brain stackOverflow jutsu
    const gridColumnCount = getComputedStyle(grid).
    getPropertyValue("grid-template-columns").split(" ").length

    let element
    // if none selected, move only 1 item, else the whole column
    if (!CoverGrid.selection) element = this.#list.navItems(down)
    else for (let i = 0; i < gridColumnCount; i++) element = this.#list.navItems(down)
    this.selectCover(element)
  }

  random() {
    const rndIdx = Math.floor( Math.random() * this.#list.itemCount )
    const cover = this.#list.findItemElement( (item, idx) => idx === rndIdx )

    this.selectCover(cover)
  }
}


class Cover extends HTMLElement {

  static tagName = 'cover-element'

  /** @type {CoverGrid} */
  static coverGrid

  constructor() {
    super()
    this.bookName = ''
    this.bookPath = ''
    this.coverPath = ''
    this.coverURL = ''
  }

  connectedCallback() {
    const title = document.createElement('p')
    title.className = 'coverTitle'
    title.textContent = this.bookName

    const delBtn = document.createElement('button')
    delBtn.className = 'coverRemoveButton'
    delBtn.setAttribute('icon', 'close')
    delBtn.tabIndex = -1
    delBtn.title = 'delist book'
    delBtn.onclick = (e) => {
      e.stopImmediatePropagation()
      this.removeBook()
    }
    
    this.style.backgroundImage = `url(${this.coverURL})`
    this.onclick = () => this.select(true)
    this.onauxclick = () => this.select(true, true)

    this.append(title, delBtn)
  }

  /**
   * Create and return a new cover element with defined properties.
   * @param {String} name Book Title.
   * @param {String} path Path to folder/archive.
   * @param {String} coverPath Path to cover image in filesystem.
   * @param {String} coverURL Encoded path to cover image for HTML display.
   * @return {Cover} 
   */
  static from(name, path, coverPath, coverURL) {
    const cover = document.createElement(this.tagName)
    
    cover.bookName = name
    cover.bookPath = path
    cover.coverPath = coverPath
    cover.coverURL = coverURL

    return cover
  }

  /**
   * Focus cover if unselected, opens if already selected.
   * @param {Boolean} newTab Either to open bookPath in a new tab.
   * @param {Boolean} keepOpen Either to close library window after open.
   */
  select(newTab = false, keepOpen = false) {
    if (!this.classList.contains('selected')) {
      return Cover.coverGrid.selectCover(this)
    }

    const libraryTab = Tab.selectedTab
    if (!keepOpen) libraryTab.close()
    
    if (newTab) new Tab('viewer', (v) => v.open(this.bookPath))
    else FRAME.open(this.bookPath)
  }
  
  /**
   * Delist cover and remove entry from library.
   */
  removeBook() {
    elecAPI.libAPI.removeFromLibrary(this.bookPath)

    if (CoverGrid.selection === this) Cover.coverGrid.nextCoverHorizontal()
    this.remove()

    CoverGrid.dirtyCache = true
    StatusBar.updateStatus()
  }
}

customElements.define(Cover.tagName, Cover)