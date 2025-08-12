// @ts-check
import { ItemList } from "../../components/itemList.js";
import { Cover } from "./coverElement.js";
import { newTab, TAB } from "../../tabs/tab.js";
import { ObservableEvents } from "../../components/observableEvents.js";
import { generalState } from "../../tabs/profiles.js";
import { matchNameOrTags } from '../../components/fileMethods.js';
import { userPreferences } from "../../components/userPreferences.js";


/**
 * @import { LibraryEntry } from "../../APIs/library/libraryStorage.js"
 * @import { Viewer } from "../viewer/viewer.js"
 */

/**
 * @typedef {'grid:coverUpdate'} CoverGridEvents
 */


/**
 * List covers and navigate them.
 */
export class CoverGrid {

  /**
   * Cached library entries.
   * @type {LibraryEntry[]}
   */
  static #cachedEntries = [];

  /**
   * Cached library entry Map, for direct lookup.
   * @type {Map<string, LibraryEntry>}
   */
  static #cachedEntryMap = new Map();

  /**
   * Either library entry cache needs to be rebuilt on next draw.
   */
  static #cacheIsDirty = true;

  /**
   * Tracks rendered elements for live thumbnail updates.
   * @type {Map<string, Cover>}
   */
  static #drawnCovers = new Map();

  /**
   * Last known cover selection.
   * @type {Cover?}
   */
  static selection = null;

  /**
   * List as cover grid.
   * @type {ItemList<LibraryEntry, Cover>}
   */
  #list;

  /**
   * @type {ObservableEvents<CoverGridEvents>}
   */
  events = new ObservableEvents();

  /**
   * @param {ItemList} hostList Host component.
   */
  constructor(hostList) {
    this.#list = hostList;

    // apply preferences
    this.#list.itemsPerPage = userPreferences.libraryItemsPerPage;
    document.body.style
      .setProperty('--cover-height', `${userPreferences.libraryCoverSize}px`);
  }

  /**
   * Retrieve and cache library entries.
   */
  static async #buildCache() {
    this.#cachedEntries = await elecAPI.getLibraryEntries();

    this.#cachedEntryMap.clear();
    this.#cachedEntries
      .forEach( entry => this.#cachedEntryMap.set(entry.path, entry) );

    this.#cacheIsDirty = false;
    console.log('Library cache (re)built.');
  }

  /**
   * Update cover entry in place.
   * @param {{key: string, entry: LibraryEntry}[]} entries
   */
  updateCovers(entries) {
    entries.forEach(({ key, entry }) => {
      const cacheItem = CoverGrid.#cachedEntryMap.get(key);

      if (cacheItem != null) {
        cacheItem.coverPath = entry.coverPath;
        cacheItem.coverURL = entry.coverURL;

        const element = CoverGrid.#drawnCovers.get(key);
        element?.updateCover(entry.coverURL);
      }
    });
  }

  /**
   * Set how many items to display per page. Reload covers.
   * @param {number} count
   */
  setItemsPerPage(count) {
    userPreferences.libraryItemsPerPage = count;
    this.#list.itemsPerPage = count;
    this.drawCovers();
  }

  /**
   * Set cover height size in pixels.
   * @param {number} size
   */
  setCoverSize(size) {
    userPreferences.libraryCoverSize = size;
    document.body.style.setProperty('--cover-height', `${size}px`);
    this.events.fire('grid:coverUpdate');

    CoverGrid.selection?.scrollIntoView({ block: 'center' });
  }

  /**
   * Draw covers whose path or tags includes query. Draws all if not given.
   * @param {string[]} [queries] Filter covers.
   */
  async drawCovers(queries) {
    if (CoverGrid.#cacheIsDirty)
      await CoverGrid.#buildCache();

    // all queries must match either path or a tag. Exclusive.
    const filterFunc = !queries
      ? undefined
      : (/** @type {LibraryEntry} */ file) => matchNameOrTags(file, queries);

    CoverGrid.#drawnCovers.clear();

    this.#list.populate(CoverGrid.#cachedEntries, (entry) => {
      const cover = Cover.from(entry);

      cover.onclick = () => {
        CoverGrid.selection !== cover
          ? this.selectCover(cover)
          : this.openCoverBook(cover);
      };

      cover.onauxclick = () => this.openCoverBook(cover, true);
      cover.onClickRemove = () => this.removeCover(cover);

      CoverGrid.#drawnCovers.set(entry.path, cover);

      return cover;
    }, filterFunc);

    // recover last selection
    const lastPath = generalState.librarySelection;

    if (lastPath !== '') {
      const cover = this.#list
        .findItemElement(item => item.path === lastPath);

      if (cover != null)
        this.selectCover(cover);
    }

    this.events.fire('grid:coverUpdate');
  }

  /**
   * Cover grid info.
   */
  getInfo() {
    return {
      itemCount: this.#list.itemCount,
      itemsPerPage: this.#list.itemsPerPage,
      coverSize: document.body.style.getPropertyValue('--cover-height')
    };
  }

  /**
   * Force build cache and draw covers.
   */
  async reloadCovers() {
    CoverGrid.#cacheIsDirty = true;
    await this.drawCovers();
  }

  /**
   * Select cover into focus and remember selection. 
   * @param {Cover} cover
   */
  selectCover(cover) {
    this.#list.selectIntoFocus(cover);

    if (CoverGrid.selection !== cover) {
      CoverGrid.selection = cover;
      generalState.librarySelection = cover.bookPath;
    }
  }

  /**
   * Delist cover and remove it from library.
   * @param {Cover} cover
   * @returns {Promise<boolean>} Success.
   */
  async removeCover(cover) {
    if ( !await elecAPI.requestLock('library') )
      return false;

    const success = await elecAPI.removeFromLibrary(cover.bookPath);

    if (success) {
      if (CoverGrid.selection === cover)
        this.nextCoverHorizontal();

      cover.remove();

      CoverGrid.#cacheIsDirty = true;
      this.events.fire('grid:coverUpdate');
    }

    await elecAPI.releaseLock('library');
    return success;
  }

  /**
   * Open book in Viewer tab.
   * @param {Cover} cover Custom cover to open.
   * @param {boolean} [keepOpen=false] Either to keep Library open.
   */
  openCoverBook(cover, keepOpen = false) {
    const selection = cover ?? CoverGrid.selection;
    if (selection == null)
      return;

    const libraryTab = keepOpen ? null : TAB

    newTab('viewer', viewer => {
     /** @type Viewer */ (viewer).open(selection.bookPath);
    });

    libraryTab?.close();
  }

  /**
   * Select next rightward or leftward cover.
   * @param {boolean} [right=true] 
   */
  nextCoverHorizontal(right = true) {
    const element = this.#list.navItems(right);

    element != null
      ? this.selectCover(element)
      : CoverGrid.selection = null;
  }

  /**
   * Select next downward or upward cover.
   * @param {boolean} [down=true] 
   */
  nextCoverVertical(down = true) {
    const grid = this.#list.currentPageDiv;
    if (grid == null)
      return;

    // big brain stackOverflow jutsu
    const gridColumnCount = getComputedStyle(grid)
      .getPropertyValue("grid-template-columns").split(" ").length;

    let element;

    // if none selected, walk one item, else the whole column
    if (CoverGrid.selection == null)
      element = this.#list.navItems(down);
    else {
      for (let i = 0; i < gridColumnCount; i++)
        element = this.#list.navItems(down);
    }

    element != null
      ? this.selectCover(element)
      : CoverGrid.selection = null;
  }

  /**
   * Select a random cover.
   */
  randomCover() {
    const rndIdx = Math.floor( Math.random() * this.#list.itemCount );
    const cover = this.#list.findItemElement( (_item, idx) => idx === rndIdx );

    if (cover != null)
      this.selectCover(cover);
  }
}
