import { GenericFrame } from "../../tabs/genericFrame.js"
import { CoverGrid } from "./coverGrid.js"
import { WatchlistPanel } from "./watchlistPanel.js"
import "./libraryActions.js"
import "./libraryAccelerators.js"
import { AppNotifier } from "../../app/notifier.js"


/**
 * Composed book and archive library.
 */
export class Library extends GenericFrame {

  static tagName = 'library-component'
  static allowDuplicate = false

  /**
   * Lock to prevent simultaneous sync calls.
   */
  #blockSync = false

  constructor() {
    super()

    this.syncProgressNotifier
    this.watchlistPanel
    this.coverGrid
  }

  connectedCallback() {
    const fragment = document.getElementById('libraryTemplate').content
    this.attachShadow({ mode: 'open' })
    this.shadowRoot.append( fragment.cloneNode(true) )

    this.syncProgressNotifier = new ProgressNotifier(this)
    this.watchlistPanel = new WatchlistPanel(this)
    this.coverGrid = new CoverGrid(this)

    this.renameTab('Library')
    this.#initEvents()
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
    if (this.#blockSync) return

    const watchFolders = Object.values( this.watchlistPanel.getWatchObject() )
    if (!watchFolders.length) return
    
    // prevent closing window while async population happens
    this.#blockSync = true
    window.onbeforeunload = () => false
    this.syncProgressNotifier.toggleVisibility()

    // use keys for now as no recursive check is in place
    let addedPaths = 0
    for (const item of watchFolders) {
      console.log('sync ' + item.path)
      addedPaths += await elecAPI.addToLibrary(item.path, item.recursive)
      this.coverGrid.reloadCovers() // repaint
    }

    // hide ProgressNotifier allow to close window again
    AppNotifier.notify(`${addedPaths} new book(s) added`, 'syncToWatchlist')
    this.syncProgressNotifier.toggleVisibility(false)
    window.onbeforeunload = null
    this.#blockSync = false
  }

  /**
   * add files to library without adding to watchlist.
   */
  async addToLibrary() {
    const files = await elecAPI.dialog({
      title: "Add to Watchlist",
      properties: ['multiSelections'], // 'openDirectory' invalidate archives
      buttonLabel: "Add Selected",
      filters: [
        { name: 'Folders', extensions: ['*'] },
        { name: 'Archives', extensions: ['zip', 'cbz'] }
      ]
    })

    if (!files || !files.length) return

    for (const file of files) {
      console.log('add ' + file + ' to library')
      await elecAPI.addToLibrary(file)
    }

    this.coverGrid.reloadCovers() // repaint
  }

  #initEvents() {
    // open folder management
    const manageWatchlistBtn = this.shadowRoot.getElementById('watchBtn')
    manageWatchlistBtn.onclick = () => this.watchlistPanel.toggleVisibility()

    // sync watch folders
    const syncBtn = this.shadowRoot.getElementById('syncBtn')
    syncBtn.onclick = () => this.syncToWatchlist()
    
    // populate coverGrid and setup button events 
    // [Workaround] Wait 0 so cover.focus() isn't ignored as frame becomes visible
    setTimeout( () => this.coverGrid.reloadCovers(), 0 );
  }
}


customElements.define(Library.tagName, Library)


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


// listen to libAPI process and notify progress
addEventListener('bookAdded', function onNewBook(ev) {
  /** @type {Library} */
  const libraryComponent = document.getElementsByTagName(Library.tagName)[0]
  
  const { current, total, newPath } = ev.detail
  libraryComponent.syncProgressNotifier.updateLabel(newPath)
  libraryComponent.syncProgressNotifier.updateBar(current, total)
})