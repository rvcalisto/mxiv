import { GenericFrame } from "../genericFrame.js"
import { CoverGrid } from "./coverGrid.js"
import { WatchlistPanel } from "./watchlistPanel.js"
import "./libraryActions.js"
import "./libraryAccelerators.js"
import { AppNotifier } from "../../components/notifier.js"


/**
 * Composed book and archive library.
 */
export class Library extends GenericFrame {

  /**
   * Current Library frame instance, if connected.
   * @type {Library?}
   */
  static #singleInstanceRef = null

  /** @type {ProgressNotifier?} */
  syncProgressNotifier

  /** @type {WatchlistPanel?} */
  watchlistPanel

  /** @type {CoverGrid?} */
  coverGrid

  // setup library progress listener
  static {
    elecAPI.onLibraryNew(function onNewBook(e, infoObj) {
      const library = Library.#singleInstanceRef
    
      if (library != null) {
        const { current, total, newPath } = infoObj
        library.syncProgressNotifier.updateLabel(newPath)
        library.syncProgressNotifier.updateBar(current, total)
      }
    })
  }

  connectedCallback() {
    const fragment = document.getElementById('libraryTemplate').content
    this.attachShadow({ mode: 'open' })
    this.shadowRoot.append( fragment.cloneNode(true) )

    this.syncProgressNotifier = new ProgressNotifier(this)
    this.watchlistPanel = new WatchlistPanel(this)
    this.coverGrid = new CoverGrid(this)

    this.tabName = 'Library'
    this.#initEvents()

    Library.#singleInstanceRef = this
  }

  disconnectedCallback() {
    Library.#singleInstanceRef = null
  }

  /** @override */
  status() {
    return {
      title: 'Library',
      infoLeft: 'Library',
      infoRight: `[${this.coverGrid.listedItemCount}]`,
      infoLeftFunc: null
    }
  }

  /**
   * Sync library to watchlist, update covers.
   */
  async syncToWatchlist() {
    const watchFolders = Object.values( this.watchlistPanel.getWatchObject() )
    if (watchFolders.length < 1) return

    if ( !await elecAPI.requestLibraryLock() ) return
    
    // prevent closing window while async population happens
    this.hold(true)
    this.syncProgressNotifier.toggleVisibility()

    console.time(`syncToWatchlist`)
    
    let addedPaths = 0
    for (const item of watchFolders) {
      console.log('sync ' + item.path)
      addedPaths += await elecAPI.addToLibrary(item.path, item.recursive)
    }

    console.timeEnd(`syncToWatchlist`)
    
    // hide ProgressNotifier, allow to close window again
    AppNotifier.notify(`${addedPaths} new book(s) added`, 'syncToWatchlist')
    this.syncProgressNotifier.toggleVisibility(false)
    this.coverGrid.reloadCovers()
    this.hold(false)

    await elecAPI.releaseLibraryLock()
  }

  /**
   * Add files to library, skip watchlist. 
   * - Spawns file-dialog window if no files are given.
   * @param {String[]} [files] Filepaths to add to library
   */
  async addToLibrary(...files) {
    if ( !await elecAPI.requestLibraryLock() ) return

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
      this.syncProgressNotifier.toggleVisibility()

      let addedPaths = 0
      for (const file of files) {
        console.log(`adding ${file} to library`)
        addedPaths += await elecAPI.addToLibrary(file, false) // non-recursive
      }

      AppNotifier.notify(`${addedPaths} new book(s) added`, 'addToLibrary')
      this.syncProgressNotifier.toggleVisibility(false)
      this.coverGrid.reloadCovers()
      this.hold(false)
    }

    await elecAPI.releaseLibraryLock()
  }

  #initEvents() {
    // add file to library using file-dialog
    const addBtn = this.shadowRoot.getElementById('addBtn')
    addBtn.onclick = () => this.addToLibrary()

    // open folder management
    const manageWatchlistBtn = this.shadowRoot.getElementById('watchBtn')
    manageWatchlistBtn.onclick = () => this.watchlistPanel.toggleVisibility()

    // sync watch folders
    const syncBtn = this.shadowRoot.getElementById('syncBtn')
    syncBtn.onclick = () => this.syncToWatchlist()

    // drag'n'drop into library
    const wrapper = this.shadowRoot.getElementById('wrapper')
    wrapper.ondrop = async (e) => {
      e.preventDefault(); e.stopPropagation();
      const files = e.dataTransfer.files
      await this.addToLibrary( ...Object.values(files).map(file => file.path) )
    }
    wrapper.ondragover = (e) => {
      e.preventDefault(); e.stopPropagation();
    }
    
    // populate coverGrid and setup button events 
    // [Workaround] Wait 0 so cover.focus() isn't ignored as frame becomes visible
    setTimeout( () => this.coverGrid.reloadCovers(), 0 );
  }
}


/**
 * Stop mouse events and notifies about sync progress.
 */
class ProgressNotifier {

  #label; #bar; #overlay; #componentRoot; #defaultMsg = 'Loading'

  /**
   * @param {Library} library Host component.
   */
  constructor(library) {
    this.#componentRoot = library.shadowRoot
    this.#createElements()
  }

  #createElements() {
    this.#overlay = document.createElement('div')
    this.#overlay.className = 'overlay'
    this.#overlay.style.opacity = 0
    this.#overlay.style.display = 'none'

    this.#label = document.createElement('p')
    this.#label.className = 'label'
    this.#label.textContent = this.#defaultMsg

    this.#bar = document.createElement('div')
    this.#bar.className = 'progressBar'
    this.#bar.appendChild( this.#bar.cloneNode(true) )
    this.#bar.firstChild.style.background = 'whitesmoke'
    this.#bar.firstChild.style.width = '0%'

    this.#overlay.appendChild(this.#label)
    this.#overlay.appendChild(this.#bar)
    this.#componentRoot.getElementById('wrapper').appendChild(this.#overlay)
  }

  /**
   * Change notifier visibility.
   * @param {true} show Either to show or hide notifier.
   * @param {Number} duration Custom visibility transition duration in ms.
   */
  toggleVisibility(show = true, duration = 150) {
    this.#overlay.style.display = ''
    this.#overlay.animate([
      { opacity: show ? 0 : 1 },
      { opacity: show ? 1 : 0 }
    ], {
      duration: duration
    }).onfinish = () => {
      this.#overlay.style.opacity = show ? 1 : 0
      this.#overlay.style.display = show ? '' : 'none'
      if (!show) this.#label.textContent = this.#defaultMsg
      if (!show) this.updateBar(0)
    }
  }

  /**
   * Write message to label.
   * @param {String} newMsg Message.
   */
  updateLabel(newMsg) {
    this.#label.textContent = newMsg
  }

  /**
   * Draw progress bar based on progress / total.
   * @param {Number} value Current progress value.
   * @param {Number} total Total progress value.
   */
  updateBar(value, total = 100) {
    const innerBar = this.#bar.firstChild
    innerBar.style.width = `${(100*value) / total}%`
  }
}
