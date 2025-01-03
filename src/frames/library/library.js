import { GenericFrame } from "../genericFrame.js"
import { CoverGrid } from "./coverGrid.js"
import { WatchlistPanel } from "./watchlistPanel.js"
import { ProgressNotifier } from "./progressNotifier.js"
import { AppNotifier } from "../../components/notifier.js"

import "./libraryActions.js"
import "./libraryAccelerators.js"


/**
 * Composed book and archive library.
 */
export class Library extends GenericFrame {

  /**
   * Current Library frame instance, if connected.
   * @type {Library?}
   */
  static #singleInstanceRef = null;

  /**
   * @type {ProgressNotifier}
   */
  #progressNotifier;

  /**
   * @type {WatchlistPanel}
   */
  watchlistPanel;

  /**
   * @type {CoverGrid}
   */
  coverGrid;

  // setup library progress listener
  static {
    elecAPI.onLibraryNew(function onNewBook(e, infoObj) {
      const library = Library.#singleInstanceRef;
    
      if (library != null) {
        const { current, total, newPath } = infoObj;
        library.#progressNotifier.updateLabel(newPath);
        library.#progressNotifier.updateBar(current, total);
      }
    })
  }

  connectedCallback() {
    const fragment = document.getElementById('libraryTemplate').content
    this.attachShadow({ mode: 'open' })
    this.shadowRoot.append( fragment.cloneNode(true) )

    const wrapper = this.shadowRoot.getElementById('wrapper')
    const list = this.shadowRoot.getElementById('library')
    this.#progressNotifier = new ProgressNotifier(wrapper)
    this.watchlistPanel = new WatchlistPanel(this)
    this.coverGrid = new CoverGrid(list)

    this.tabName = 'Library'
    this.#initEvents()

    Library.#singleInstanceRef = this
  }

  disconnectedCallback() {
    Library.#singleInstanceRef = null
    CoverGrid.selection = null
  }

  /**
   * @inheritdoc
   */
  onSelected() {
    // scroll selected cover into view
    const cover = CoverGrid.selection;
    if (cover) cover.scrollIntoView({ block: 'center' });
  }

  /**
   * @inheritdoc
   */
  status() {
    const { itemCount, itemsPerPage, coverSize } = this.coverGrid.getInfo();
    
    return {
      title: 'Library',
      infoLeft: 'Library',
      infoRight: `${itemsPerPage} @ ${coverSize} [${itemCount}]`,
      infoLeftFunc: null
    }
  }

  /**
   * Sync library to watchlist, update covers.
   */
  async syncToWatchlist() {
    const watchItems = this.watchlistPanel.getItems()
    if (watchItems.length < 1) return

    if ( !await elecAPI.requestLock('library') ) return
    
    // prevent closing window while async population happens
    this.hold(true)
    this.#progressNotifier.toggleVisibility(true)

    console.time(`syncToWatchlist`)
    
    let addedPaths = 0
    for (const item of watchItems) {
      console.log('sync ' + item.path)
      addedPaths += await elecAPI.addToLibrary(item.path, item.recursive)
    }

    console.timeEnd(`syncToWatchlist`)
    
    // hide ProgressNotifier, allow to close window again
    AppNotifier.notify(`${addedPaths} new book(s) added`, 'syncToWatchlist')
    this.#progressNotifier.toggleVisibility(false)
    this.coverGrid.reloadCovers()
    this.hold(false)

    await elecAPI.releaseLock('library')
  }

  /**
   * Add files to library, skip watchlist. 
   * - Spawns file-dialog window if no files are given.
   * @param {String[]} [files] Filepaths to add to library
   */
  async addToLibrary(...files) {
    if ( !await elecAPI.requestLock('library') ) return

    if (files.length < 1) {
      files = await elecAPI.dialog({
        title: "Add Folder to Library",
        properties: ['openDirectory'],
        buttonLabel: "Add Selected"
      })
    }

    if (files != null && files.length > 0) {
      // prevent closing window while async population happens
      this.hold(true)
      this.#progressNotifier.toggleVisibility(true)

      let addedPaths = 0
      for (const file of files) {
        console.log(`adding ${file} to library`)
        addedPaths += await elecAPI.addToLibrary(file, false) // non-recursive
      }

      AppNotifier.notify(`${addedPaths} new book(s) added`, 'addToLibrary')
      this.#progressNotifier.toggleVisibility(false)
      this.coverGrid.reloadCovers()
      this.hold(false)
    }

    await elecAPI.releaseLock('library')
  }

  #initEvents() {
    // add file to library using file-dialog
    const addBtn = this.shadowRoot.getElementById('addBtn')
    addBtn.onclick = () => this.addToLibrary()

    // open folder management
    const manageWatchlistBtn = this.shadowRoot.getElementById('watchBtn')
    manageWatchlistBtn.onclick = () => this.watchlistPanel.toggleVisibility(true)

    // sync watch folders
    const syncBtn = this.shadowRoot.getElementById('syncBtn')
    syncBtn.onclick = () => this.syncToWatchlist()

    // drag'n'drop into library
    const wrapper = this.shadowRoot.getElementById('wrapper')
    wrapper.ondrop = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const filepaths = Object.values(e.dataTransfer.files)
        .map( file => elecAPI.getPathForFile(file) );
      
      await this.addToLibrary(...filepaths);
    }
    
    wrapper.ondragover = (e) => {
      e.preventDefault();
      e.stopPropagation();
    }

    // update cover count in status
    this.coverGrid.events.observe('grid:coverUpdate', () => this.refreshStatus())
    
    // populate cover grid
    this.coverGrid.reloadCovers();
  }
}
