import { ItemList } from "../../app/itemList.js"
import { Tab } from "../../tabs/tab.js";
import { Library } from "./library.js";


/**
 * List covers and navigate them.
 */
export class CoverGrid {

  static #libraryStorage = 'libraryPaths'

  /**
   * Cached library entry collection.
   * @type {import('../../APIs/libAPI.js'.LibraryObject)}
   */
  static #libraryCache = {}

  /**
   * Library entry keys sorted by path.
   * @type {String[]}
   */
  static #sortedLibraryKeys = []

  /**
   * Either library entry cache needs to be rebuilt on next draw.
   */
  static #dirtyCache = true

  /**
   * Last known cover selection.
   * @type {Cover?}
   */
  static selection = null

  /**
   * List as cover grid.
   * @type {ItemList}
   */
  #list

  #library; #collator
  
  /**
   * @param {Library} library Host component.
   */
  constructor(library) {
    this.#list = library.shadowRoot.getElementById('library')
    this.#library = library
    this.#collator = new Intl.Collator('en', { numeric: true })
  }

  /**
   * Read and store library entry collection and order in cache.
   */
  #buildCache() {
    const localEntry = localStorage.getItem(CoverGrid.#libraryStorage)
    CoverGrid.#libraryCache = localEntry ? JSON.parse(localEntry) : {}
  
    CoverGrid.#sortedLibraryKeys = Object.keys(CoverGrid.#libraryCache)
    CoverGrid.#sortedLibraryKeys.sort( (pathA, pathB) => this.#collator.compare(pathA, pathB) ) 
  
    CoverGrid.#dirtyCache = false
    console.log('Library cache (re)built.');
  }

  /**
   * Draw covers whose path or tags includes query. Draws all if not given.
   * @param {String[]?} queries Filter covers.
   */
  drawCovers(queries) {
    if (CoverGrid.#dirtyCache) this.#buildCache()

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
      const cover = Cover.from(name, path, coverPath, coverURL)
      
      cover.onclick = () => this.selectCover(cover)
      cover.onauxclick = () => this.selectCover(cover, true)
      cover.onClickRemove = () => this.removeCover(cover)

      return cover
    }, filterFunc)
    // console.timeEnd('populate library')

    // recover last selection
    if (CoverGrid.selection) {
      const lastSelected = this.#list.findItemElement(item => item === CoverGrid.selection.bookPath)
      if (lastSelected) this.selectCover(lastSelected)
    }

    this.#library.refreshStatus()
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
    CoverGrid.#dirtyCache = true
    this.drawCovers()
  }

  /**
   * Select cover into focus and remember selection. 
   * @param {Cover} cover
   * @param {false} keepOpen Keep Library open after openning book.
   */
  selectCover(cover, keepOpen = false) {
    if (CoverGrid.selection !== cover ) {
      this.#list.selectIntoFocus(cover)
      CoverGrid.selection = cover
      return
    }

    if (!keepOpen) Tab.selected.close()
    new Tab('viewer', (v) => v.open(cover.bookPath) )
  }

  /**
   * Delist cover and remove it from library.
   * @param {Cover} cover 
   */
  removeCover(cover) {
    elecAPI.libAPI.removeFromLibrary(cover.bookPath)

    if (CoverGrid.selection === cover) this.nextCoverHorizontal()
    cover.remove()

    CoverGrid.#dirtyCache = true
    this.#library.refreshStatus()
  }

  /**
   * Open book in Viewer tab.
   * @param {false} keepOpen Either to keep Library open.
   */
  openCoverBook(keepOpen = false) {
    const selectedBook = CoverGrid.selection
    if (selectedBook) this.selectCover(selectedBook, keepOpen)
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

  randomCover() {
    const rndIdx = Math.floor( Math.random() * this.#list.itemCount )
    const cover = this.#list.findItemElement( (item, idx) => idx === rndIdx )

    this.selectCover(cover)
  }
}


/**
 * Library cover object.
 */
class Cover extends HTMLElement {

  static tagName = 'cover-element'

  constructor() {
    super()

    this.bookName = ''
    this.bookPath = ''
    this.coverPath = ''
    this.coverURL = ''

    /**
     * Set behavior on 'remove' button click.
     * @type {Function?}
     */
    this.onClickRemove
  }

  connectedCallback() {
    const title = document.createElement('p')
    title.className = 'coverTitle'
    title.textContent = this.bookName

    const removeBtn = document.createElement('button')
    removeBtn.className = 'coverRemoveButton'
    removeBtn.setAttribute('icon', 'close')
    removeBtn.title = 'delist book'
    removeBtn.tabIndex = -1

    this.style.backgroundImage = `url(${this.coverURL})`
    
    removeBtn.onclick = (e) => {
      e.stopImmediatePropagation()
      if (this.onClickRemove) this.onClickRemove()
    }
    
    this.append(title, removeBtn)
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
}

customElements.define(Cover.tagName, Cover)