import { CoverGrid } from "./coverGrid.js"
import "./libraryActions.js"
import "./libraryAccelerators.js"
import { AppNotifier } from "../../app/notifier.js"

/**
 * Composed book and archive library.
 */
export class Library extends HTMLElement {

  static tagName = 'library-component'

  constructor() {
    super()

    // components
    this.watchlistPanel
    this.syncProgessNotifier
    this.coverGrid
  }

  connectedCallback() {
    const template = document.getElementById('libraryTemplate')
    const fragment = template.content
    this.attachShadow({ mode: 'open' })
    this.shadowRoot.append( fragment.cloneNode(true) )

    this.watchlistPanel = new WatchlistPanel(this)
    this.syncProgessNotifier = new ProgressNotifier(this)
    this.coverGrid = new CoverGrid(this)

    this.tab.renameTab('Library')
    this.#initEvents()
  }

  /** Allow component to be stored and restored. */
  storeState() {}

  /*** Status bar object implementation. */
  barStatus() {
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
    if (!watchFolders.length) return
    
    // prevent closing window while async population happens
    window.onbeforeunload = () => false
    this.syncProgessNotifier.toggleVisibility()

    // use keys for now as no recursive check is in place
    let addedPaths = 0
    for (const item of watchFolders) {
      console.log('sync ' + item.path)
      addedPaths += await elecAPI.libAPI.addToLibrary(item.path, item.recursive)
      this.coverGrid.reloadCovers() // repaint
    }

    AppNotifier.notify(`${addedPaths} new book(s) added`, 'syncToWatchlist')
    this.syncProgessNotifier.toggleVisibility(false)
    // allow to close window again
    window.onbeforeunload = null
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
      await elecAPI.libAPI.addToLibrary(file)
    }

    this.coverGrid.reloadCovers() // repaint
  }


  #initEvents() {

    this.onresize = () => {
      const selectedBook = CoverGrid.selection
      if (selectedBook) selectedBook.scrollIntoView({ block:"nearest" })
    }

    // open folder management
    const manageWatchlistBtn = this.shadowRoot.getElementById('watchBtn')
    manageWatchlistBtn.onclick = () => this.watchlistPanel.toggleVisibility()

    // sync watch folders
    const syncBtn = this.shadowRoot.getElementById('syncBtn')
    syncBtn.onclick = () => this.syncToWatchlist()
    
    // populate coverGrid and setup button events 
    // (+timeout hack so focus doesn't get skipped as tab frame style.display: none -> '')
    setTimeout(() => this.coverGrid.reloadCovers(), 0);
  }

}


customElements.define(Library.tagName, Library)


/**
 * Add and remove folders from watchlist.
 */
class WatchlistPanel {
  
  #watchlistStorage = 'libraryWatch'
  /** @type {HTMLElement} */
  #overlay
  /** @type {ShadowRoot} */
  #componentRoot

  constructor(library) {
    this.#componentRoot = library.shadowRoot
    this.#overlay = library.shadowRoot.getElementById('wrapper').getElementsByClassName('overlay')[0]
    this.#addEventListeners()
  }

  /**
   * @type {Boolean}
   */
  get isVisible() {
    return this.#overlay.style.display == ''
  }

  /**
   * @typedef {{path:string, recursive:boolean}} WatchlistItem
   */

  /**
   * Get all paths in watchlist.
   * @returns {Object<string, WatchlistItem>}
   */
  getWatchObject() {
    const watchObj = JSON.parse(localStorage.getItem(this.#watchlistStorage))
    return watchObj ? watchObj : {}
  }

  /**
   * Store watchlist items object.
   * @param {Object<string, WatchlistItem>} watchObject Watchlist object.
   */
  #storeWatchObject(watchObject) {
    localStorage.setItem(this.#watchlistStorage, JSON.stringify(watchObject))
  }

  /**
   * Add folder path from watchlist.
   * @param {String} folder Path to folder.
   */
  addPath(folder) {
    let watchObj = this.getWatchObject()

    watchObj[folder] = {
      'path': folder,
      'recursive': true
    }

    this.#storeWatchObject(watchObj)
    console.log(`added ${folder} to watchlist`)
  }

  /**
   * Update recursion option for watchlist item.
   * @param {String} pathKey WatchlistItem path.
   * @param {Boolean} recursive New recursive value.
   */
  setRecursion(pathKey, recursive) {
    let watchObj = this.getWatchObject()

    watchObj[pathKey].recursive = recursive
    this.#storeWatchObject(watchObj)
  }

  /**
   * Remove watchlist item from watchlist.
   * @param {String} itemPath Path to item.
   */
  removePath(itemPath) {
    const watchObj = this.getWatchObject()
    if (!watchObj || !watchObj[itemPath])
      return AppNotifier.notify(`no ${itemPath} in watchlist to remove`);

    delete watchObj[itemPath]
    this.#storeWatchObject(watchObj)
    console.log(`removed ${itemPath} from watchlist`)
  }

  /**
   * Draw list of folders to add to library on sync.
   */
  #drawList() {
    // clean list
    const folderList = this.#componentRoot.getElementById('folderList')
    folderList.textContent = ''
  
    // populate list
    for ( const item of Object.values( this.getWatchObject() ) ) {
      const div = document.createElement('div')
      div.innerHTML = `
      <div class="folderItem">
        <p>${item.path}</p>
        <p title="evaluate subfolders">recursive<input type="checkbox""></p>
        <button>remove folder</button>
      </div>`

      folderList.appendChild(div)
      const recursiveCheck = div.getElementsByTagName('input')[0]
      const removeFolderBtn = div.getElementsByTagName('button')[0]
  
      // update recursion
      recursiveCheck.checked = item.recursive
      recursiveCheck.oninput = () => {
        this.setRecursion(item.path, recursiveCheck.checked)
      }

      // remove path from list
      removeFolderBtn.onclick = () => {
        this.removePath(item.path)
        this.#drawList()
      }
    }
  }

  /**
   * Toggle watch list visibilty.
   * @param {Boolean} show Either to force visibilit on or off.
   * @param {Number} duration Animation duration in ms.
   */
  toggleVisibility(show = true, duration = 150) {
    if (show) this.#drawList()
    
    this.#overlay.style.display = ''
    this.#overlay.animate([
      { opacity: show ? 0 : 1 },
      { opacity: show ? 1 : 0 }
    ],{
      duration: duration
    }).onfinish = () => {
      this.#overlay.style.opacity = show ? 1 : 0
      this.#overlay.style.display = show ? '' : 'none'
    }
  }

  #addEventListeners() {
    // exit folder management
    this.#overlay.onclick = (e) => {
      if (e.target != this.#overlay) return
      this.toggleVisibility(false)
    }
    
    // add new folder to watchlist, open dialog
    const addtoBtn = this.#componentRoot.getElementById('addToWatch')
    addtoBtn.onclick = async () => {
      const files = await elecAPI.dialog({
        title: "Add to Watchlist",
        properties: ['multiSelections'], // 'openDirectory' invalidates archives
        buttonLabel: "Add Selected",
        filters: [
          { name: 'Folders', extensions: ['*'] },
          { name: 'Archives', extensions: ['zip', 'cbz'] }
        ]
      })

      if (!files) return
      files.forEach(file => this.addPath(file))
      this.#drawList()
    }
  }
}


/**
 * Stop mouse events and notifies about sync progress.
 */
class ProgressNotifier {

  #overlay; #label; #defaultMsg; #bar; #componentRoot

  constructor(library) {
    this.#overlay
    this.#label
    this.#bar
    this.#defaultMsg = 'Loading'

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
    this.#bar.appendChild(this.#bar.cloneNode(true))
    this.#bar.firstChild.style.background = 'whitesmoke'
    this.#bar.firstChild.style.width = '0%'

    this.#overlay.appendChild(this.#label)
    this.#overlay.appendChild(this.#bar)
    this.#componentRoot.getElementById('wrapper').appendChild(this.#overlay)
  }

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
   * @param {String} newMsg Message
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
  libraryComponent.syncProgessNotifier.updateLabel(newPath)
  libraryComponent.syncProgessNotifier.updateBar(current, total)
})