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
    this.shadowRoot.append(fragment.cloneNode(true))

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
    const watchFolders = this.watchlistPanel.getPathArray()
    if (!watchFolders) return
    
    // prevent closing window while async population happens
    window.onbeforeunload = () => false
    this.syncProgessNotifier.toggleVisibility()

    // use keys for now as no recursive check is in place
    let addedPaths = 0
    for (const folder of watchFolders) {
      console.log('sync ' + folder)
      addedPaths += await elecAPI.libAPI.addToLibrary(folder)
      this.coverGrid.reloadCovers() // repaint
    }

    AppNotifier.notify(`${addedPaths} new book(s) added`, 'syncToWatchlist')
    this.syncProgessNotifier.toggleVisibility(false)
    // allow to close window again
    window.onbeforeunload = null
  }


  /**
   * add files to library.
   */
  async addToLibrary() {
    const files = await elecAPI.dialog({
      title: "Add Folder to Library",
      properties: ['openDirectory'],
      buttonLabel: "Select Folder",
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
      if (selectedBook) selectedBook.scrollIntoView({block:"nearest"})
    }

    // add folder recursively
    const addBtn = this.shadowRoot.getElementById('addBtn')
    addBtn.onclick = async () => this.addToLibrary()

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
  
  #overlay; #watchlistStorage = 'libraryWatch'

  constructor(library) {
    this.componentRoot = library.shadowRoot
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
   * Get all paths in watchlist.
   * @returns {String[]}
   */
  getPathArray() {
    const libObj = JSON.parse(localStorage.getItem(this.#watchlistStorage))
    return libObj ? Object.keys(libObj) : [] 
  }

  /**
   * Add folder path from watchlist.
   * @param {String} folder Path to folder.
   */
  addPath(folder) {
    let libObj = JSON.parse(localStorage.getItem(this.#watchlistStorage))
    if (!libObj) libObj = {}

    // add path if not already
    libObj[folder] = {
      'path' : folder,
      // put recursive option here when implemented
    }

    localStorage.setItem(this.#watchlistStorage, JSON.stringify(libObj))
    console.log(`added ${folder} to watchlist`)
  }

  /**
   * Remove folder path from watchlist.
   * @param {String} folder Path to folder.
   */
  removePath(folder) {
    const libObj = JSON.parse(localStorage.getItem(this.#watchlistStorage))
    if (!libObj || !libObj[folder]) return AppNotifier.notify(`no ${folder} in watchlist to remove`)

    delete libObj[folder]
    localStorage.setItem(this.#watchlistStorage, JSON.stringify(libObj))
    console.log(`removed ${folder} from watchlist`)
  }

  /**
   * Draw list of folders to add to library on sync.
   */
  drawList() {
    // clean list
    const folderList = this.componentRoot.getElementById('folderList')
    folderList.textContent = ''
  
    // populate list
    for (const folder of this.getPathArray()) {
      const div = document.createElement('div')
      div.className = 'folderItem'
      const p = document.createElement('p')
      p.textContent = folder
      const removeFolderBtn = document.createElement('button')
      removeFolderBtn.textContent = 'remove folder'
  
      div.append(p, removeFolderBtn)
      folderList.appendChild(div)
  
      // remove path from list
      removeFolderBtn.onclick = () => {
        this.removePath(folder)
        this.drawList()
      }
    }
  }

  /**
   * Toggle watch list visibilty.
   * @param {Boolean} show Either to force visibilit on or off.
   * @param {Number} duration Animation duration in ms.
   */
  toggleVisibility(show = true, duration = 150) {
    if (show) this.drawList()
    
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
    const addToWatchBtn = this.componentRoot.getElementById('newFolderBtn')
    addToWatchBtn.onclick = async () => {
      const files = await elecAPI.dialog({
        title: "Add Folder to Watch list",
        properties: ['openDirectory'],
        buttonLabel: "Select Folder",
      })

      if (!files) return
      files.forEach(file => this.addPath(file))
      this.drawList()
    }
  }
}


/**
 * Stop mouse events and notifies about sync progress.
 */
class ProgressNotifier {

  #overlay; #label; #defaultMsg; #bar

  constructor(library) {
    this.#overlay
    this.#label
    this.#bar
    this.#defaultMsg = 'Loading'

    this.componentRoot = library.shadowRoot
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
    this.componentRoot.getElementById('wrapper').appendChild(this.#overlay)
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