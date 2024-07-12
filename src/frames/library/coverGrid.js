import { ItemList } from "../../components/itemList.js"
import { Cover } from "./coverElement.js";
import { Tab } from "../../tabs/tab.js";
import { ObservableEvents } from "../../components/observableEvents.js";


/**
 * @typedef {import('../../APIs/library/libraryStorage.js').LibraryEntry} LibraryEntry
 */

/**
 * @typedef {'grid:coverUpdate'} CoverGridEvents
 */


/**
 * List covers and navigate them.
 */
export class CoverGrid {

  /**
   * Cached library entry collection.
   * @type {LibraryEntry[]}
   */
  static #libraryCache = []

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
   * @type {ItemList<LibraryEntry, Cover>}
   */
  #list

  /**
   * @type {ObservableEvents<CoverGridEvents>}
   */
  events = new ObservableEvents()
  
  /**
   * @param {ItemList} hostList Host component.
   */
  constructor(hostList) {
    this.#list = hostList
  }

  /**
   * Cache sorted library entry collection.
   */
  async #buildCache() {
    CoverGrid.#libraryCache = await elecAPI.getLibraryEntries()
    CoverGrid.#dirtyCache = false
    console.log('Library cache (re)built.');
  }

  /**
   * Returns library entry filter based on name and tags.
   * @param {string[]} queries 
   * @returns {(entry:LibraryEntry)=>boolean}
   */
  #libraryFilter(queries) {
    return (entry) => {
      const bookTags = elecAPI.getTags(entry.path)
      const bookName = entry.name.toLowerCase()

      for (let query of queries) {
        if (query[0] === '-') {
          // exclude tag query from results
          const match = bookTags.includes( query.slice(1) )
          if (match) return false
        } else {
          const match = bookName.includes(query) || bookTags.includes(query)
          if (!match) return false
        }
      }

      return true
    }
  }

  /**
   * Draw covers whose path or tags includes query. Draws all if not given.
   * @param {String[]} [queries] Filter covers.
   */
  async drawCovers(queries) {
    if (CoverGrid.#dirtyCache) await this.#buildCache()

    // all queries must match either path or a tag. Exclusive.
    const filterFunc = !queries ? undefined : this.#libraryFilter(queries)

    // console.time('populate library')
    this.#list.populate(CoverGrid.#libraryCache, (entry) => {
      const cover = Cover.from(entry)
      
      cover.onclick = () => this.selectCover(cover)
      cover.onauxclick = () => this.selectCover(cover, true)
      cover.onClickRemove = () => this.removeCover(cover)

      return cover
    }, filterFunc)
    // console.timeEnd('populate library')

    // recover last selection
    if (CoverGrid.selection) {
      const lastSelectedPath = CoverGrid.selection.bookPath
      const lastSelected = this.#list
        .findItemElement(item => item.path === lastSelectedPath)
      
      if (lastSelected) this.selectCover(lastSelected)
    }

    this.events.fire('grid:coverUpdate')
  }

  /**
   * Number of covers listed.
   * @returns {number}
   */
  getCoverCount() {
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
   * @param {boolean} [keepOpen=false] Keep Library open after openning book.
   */
  selectCover(cover, keepOpen = false) {
    if (CoverGrid.selection !== cover ) {
      this.#list.selectIntoFocus(cover)
      CoverGrid.selection = cover
      return
    }

    if (!keepOpen) Tab.selected?.close()
    new Tab('viewer', viewer => {
      /** @type {import('../viewer/viewer.js').Viewer} */ 
      (viewer).open(cover.bookPath)
    })
  }

  /**
   * Delist cover and remove it from library.
   * @param {Cover} cover
   * @returns {Promise<Boolean>} Success.
   */
  async removeCover(cover) {
    if ( !await elecAPI.requestLibraryLock() ) return false

    const success = await elecAPI.removeFromLibrary(cover.bookPath)
    if (success) {
      if (CoverGrid.selection === cover) this.nextCoverHorizontal()
      cover.remove()
  
      CoverGrid.#dirtyCache = true
      this.events.fire('grid:coverUpdate')
    }
  
    await elecAPI.releaseLibraryLock()
    return success
  }

  /**
   * Open book in Viewer tab.
   * @param {boolean} [keepOpen=false] Either to keep Library open.
   */
  openCoverBook(keepOpen = false) {
    const selectedBook = CoverGrid.selection
    if (selectedBook) this.selectCover(selectedBook, keepOpen)
  }

  /**
   * Select next rightward or leftward cover.
   * @param {boolean} [right=true] 
   */
  nextCoverHorizontal(right = true) {
    const element = this.#list.navItems(right)
    if (element) this.selectCover(element)
  }

  /**
   * Select next downward or upward cover.
   * @param {boolean} [down=true] 
   */
  nextCoverVertical(down = true) {
    const grid = this.#list.currentPageDiv
    if (!grid) return // empty #list

    // big brain stackOverflow jutsu
    const gridColumnCount = getComputedStyle(grid)
      .getPropertyValue("grid-template-columns").split(" ").length

    let element
    // if none selected, move only 1 item, else the whole column
    if (!CoverGrid.selection) element = this.#list.navItems(down)
    else for (let i = 0; i < gridColumnCount; i++) element = this.#list.navItems(down)
    
    if (element != null)
      this.selectCover(element)
  }

  /**
   * Select a random cover.
   */
  randomCover() {
    const rndIdx = Math.floor( Math.random() * this.#list.itemCount )
    const cover = this.#list.findItemElement( (item, idx) => idx === rndIdx )

    if (cover != null)
      this.selectCover(cover)
  }
}
