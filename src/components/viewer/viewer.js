import { FileBook } from "./fileBook.js"
import { FileExplorer } from "./fileExplorer.js"
import { View } from "../view/view.js"

// for visibily toggle static methods
import * as StatusBar from "../../tabs/statusBar.js"
import { Tab } from "../../tabs/tab.js"

import "./viewerActions.js"
import "./viewerAccelerators.js"
import "./keyEventController.js"
import { AppNotifier } from "../../app/notifier.js"

/**
 * Composed File Explorer & Media Viewer component.
 */
export class Viewer extends HTMLElement {

  static tagName = 'viewer-component'

  /** Display flow state, prevents unloaded page flips. */
  #loading = false
  /** Last Page flip direction for auto-scroll. */
  #lastFlipRight = true
  
  constructor() {
    super()

    /** @type {String[]} Currently loaded paths for state replication */
    this.openArgs = []
    
    /** @type {FileBook} */
    this.fileBook

    /** @type {View} */
    this.viewComponent

    /** @type {FileExplorer} */
    this.fileExplorer
    
    /** @type {Tab} Tab instance reference set by Tab before connectedCallback() */
    this.tab
  }


  // called when element is appended to document 
  connectedCallback() {
    // clone template content into shadow root
    const fragment = document.getElementById('viewerTemplate').content
    this.attachShadow({ mode: 'open' })
    this.shadowRoot.append(fragment.cloneNode(true))

    // composition instances
    this.fileBook = new FileBook()
    this.viewComponent = this.shadowRoot.getElementById('viewInstance')
    this.fileExplorer = this.shadowRoot.getElementById('fileExplorer')
    this.fileExplorer.viewer = this

    this.#initEvents()
    console.log('new viewer tab, bookID:', this.fileBook.bookID);
  }

  // triggered on DOM disconect (tab closed and on quit)
  disconnectedCallback() {
    this.fileBook.closeBook()
  }

  /**
   * Tab method, allow duplication and preserve state. 
   * @param {Viewer} newInstance 
   */
  async duplicate(newInstance) {
    newInstance.restoreState( this.storeState() )
  }

  /**
   * Tab method, store state persistence object.
   */
  storeState() {
    return {
      tabName: this.tab.name,

      paths: this.openArgs,

      filterQuery: this.fileBook.filterQuery,
      mediaState: this.viewComponent.state(),

      fileExplorer: {
        dir: this.fileExplorer.currentDir,
        mode: this.fileExplorer.mode,
        show: !this.fileExplorer.isHidden
      },
    }
  }

  /**
   * Tab method, restore state.
   * @param {} stateObj State object.
   */
  async restoreState(stateObj) {
    // open path on file
    if (stateObj.paths.length) await this.open(...stateObj.paths)
    if (stateObj.tabName) this.tab.renameTab(stateObj.tabName)
    
    // load media state
    this.viewComponent.state(stateObj.mediaState)

    // don't autoplay if restoring video
    this.viewComponent.autoplay = this.viewComponent.fileType != 'video'

    // re-apply filter (idx based, file order/count may have changed)
    if (stateObj.filterQuery.length) this.filter(...stateObj.filterQuery)

    // pass fileExplorer parameters
    this.fileExplorer.currentDir = stateObj.fileExplorer.dir
    this.fileExplorer.mode = stateObj.fileExplorer.mode
    if (stateObj.fileExplorer.show) this.fileExplorer.togglePanel(true)
  }

  /** 
   * Populate fileBook with given paths, sync fileExplorer and display first file.
   * @param {...String} paths Path arguments. Will display first path if file.
   */
  async open(...paths) {
    // Store the exact paths to replicate this instance. Prevents
    // failed/partial duplication when tab hasn't yet loaded all files.
    this.openArgs = paths
    const startIdx = await this.fileBook.load(...paths)
    if (startIdx < 0) {
      AppNotifier.notify('no files to open', 'viewer:open')
      return
    }

    // name tab path basenames, sorted for order-redundancy
    const basedirs = this.fileBook.paths.map(dir => dir.name)
    this.tab.renameTab( String(basedirs) )

    this.gotoPage(startIdx)
    this.fileExplorer.reload()
  }

  /**
   * Find and present file with matching filepath substrings. 
   * @param {...String} queries File name or substring to find.
   */
  find(...queries) {
    const idx = this.fileBook.getIdxOf(...queries)
    if (idx > -1) this.gotoPage(idx)
    else AppNotifier.notify('no matches')
  }

  /**
   * Filter files by partial words and tags.
   * @param  {...String} queries Tags and substrings to filter for.
   */
  filter(...queries) {
    const currentFilePath = this.fileBook.currentFile.path
    const fileCount = this.fileBook.filter(...queries)

    // if nothing changed, exit
    if (fileCount === 0) return AppNotifier.notify('no matches')

    // new filter exclude currentFile, get new one
    if (this.fileBook.getIdxOf(currentFilePath) === -1) this.flipPage()
    // update status bar and reload fileExplorer
    this.updateBar()
    this.fileExplorer.reload()
    AppNotifier.notify(fileCount > 0 ? `${fileCount} files matched` : 'clear filter')
  }

  /**
   * Present next page.
   * @param {Boolean} forward Flip to the right.
   */
  flipPage(forward = true) {
    this.#lastFlipRight = forward
    this.gotoPage(this.fileBook.page + (forward ? 1 : -1))
  }

  /**
   * Set page index in fileBook and display file.
   * @param {Number} pageIdx
   */
  async gotoPage(pageIdx) {
    // show empty view, trigger signal
    if (!this.fileBook.files.length) {
      this.viewComponent.display(null)
      return
    }

    // block until resolve
    if (this.#loading) return
    this.#loading = true

    // get right file, set openArgs
    const file = this.fileBook.setPageIdx(pageIdx)
    const paths = this.fileBook.paths.map(dir => dir.path)
    this.openArgs = [file.path, ...paths] 

    // wait for display (loaded) and resolve block
    let success = await this.viewComponent.display(file.pathURL, file.category)
    this.#loading = false
    
    if (!success) {
      console.log('Failed to load resource. Delist file and skip.')
      const equivalentIdx = this.fileBook.delistFile(file)
      this.gotoPage(equivalentIdx)
    }
  }

  /**
   * Display random file in fileBook.
   */
  gotoRandom() {
    // if 2 files or less, flip page
    const fileCount = this.fileBook.files.length
    if (fileCount < 3) return this.gotoPage(this.fileBook.page + 1)

    // roll until it's a different index from current one
    let randomIdx = Math.floor(Math.random() * fileCount)
    if (randomIdx === this.fileBook.page) return this.gotoRandom()

    this.gotoPage(randomIdx)
  }

  /**
   * Reload fileBook and fileExplorer while keeping current state.
   */
  async reload() {
    const currentFile = this.fileBook.currentFile
    if (!currentFile) {
      this.fileExplorer.reload()
      AppNotifier.notify('reloaded fileExplorer', 'fileReload')
      return
    }

    const previousFilters = this.fileBook.filterQuery
    const paths = this.fileBook.paths.map(dir => dir.path)
    const tabName = this.tab.name

    // re-open current paths, starting by current-file
    AppNotifier.notify('reloading files...', 'fileReload')
    await this.open(currentFile.path, ...paths)

    // restore tab name and re-apply filter
    this.tab.renameTab(tabName)
    if (previousFilters.length) this.filter(...previousFilters)
    AppNotifier.notify('files reloaded', 'fileReload')
  }

  /**
   * Run user defined script on current file.
   * @param {String} userScript User script.
   * @param {String} optMsg Message to display on execution.
   * @returns {boolean} Either command was run or not.
   */
  runOnPage(userScript) {
    const currentFile = this.fileBook.currentFile
    const success = elecAPI.fileAPI.runOnFile(userScript, currentFile)
    return success
  }
  
  /**
   * Delete current file from filesystem.
   */
  deletePage() {
    const currentFile = this.fileBook.currentFile
    if (!currentFile) return AppNotifier.notify('no loaded file to delete', 'pageDel')
    
    const forReal = confirm(`Permanently delete current file:\n${currentFile.name}?`)
    if (!forReal) return

    // delist current file and delete it from filesystem
    const equivalentIdx = this.fileBook.delistFile(currentFile)
    elecAPI.fileAPI.deleteFile(currentFile.path)

    // update explorer
    this.fileExplorer.reload()

    // goto new last-file if current idx is out-bounds, else refresh page
    this.gotoPage(equivalentIdx)
    AppNotifier.notify('removed ' + currentFile.path)
  }

  /**
   * Toggle fullscreen using electron instead of requestFullscreen to avoid
   * ESC reverting fullscreen and to take in accound every component that
   * should still be handled separately (Tab bar. StatusBar, fileExplorer).
   * Kinda messy, but works as intended.
   */
  async toggleFullscreen() {
    const isFullscreen = await elecAPI.toggleFullscreen()
    
    // store previous state when going fullscreen
    if (isFullscreen) this.wasVisibleBeforeFullscreen = {
      statusBar: StatusBar.visibility,
      tabBar: Tab.tabBarIsVisible,
      fileExplorer: !this.fileExplorer.isHidden
    }
    
    // for previously visible components, toggle visibility accordingly
    const { statusBar, tabBar, fileExplorer } = this.wasVisibleBeforeFullscreen
    
    if (statusBar) StatusBar.toggle(!isFullscreen)
    if (tabBar) Tab.toggleTabBar(!isFullscreen)
    if (fileExplorer) {
      await this.fileExplorer.togglePanel(!isFullscreen)
      this.fileExplorer.blur()
    }
  }
  
  /**
   * Setup event listeners.
   */
  #initEvents() {
    // drag'n'drop
    this.viewComponent.ondrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const files = e.dataTransfer.files
      this.open(...Object.keys(files).map((key) => files[key].path))
    }
    // needed for drop event
    this.viewComponent.ondragover = (e) => {
      e.preventDefault();
      e.stopPropagation();
    }

    // flip image depending on the click position
    this.viewComponent.oncontextmenu = (e) => {
      if (this.viewComponent.fileType != 'image') return
      const forward = e.offsetX >= this.viewComponent.clientWidth / 2
      this.flipPage(forward)
    }

    // fileBook events
    this.addEventListener('fileExplorer:open', (e) => {
      const filepath = e.detail, fileIdx = this.fileBook.getIdxOf(filepath)
      if (fileIdx > -1) this.gotoPage(fileIdx)
      else this.open(filepath)
    })

    // view events
    this.addEventListener('view:playing', (e) => this.tab.playing = e.detail)
    this.addEventListener('view:next', () => this.flipPage())
    this.addEventListener('view:random', () => this.gotoRandom())
    this.addEventListener('view:previous', () => this.flipPage(false))
    this.addEventListener('view:mode', () => this.updateBar())
    this.addEventListener('view:zoom', () => this.updateBar())
    this.addEventListener('view:fullscreen', () => this.toggleFullscreen())
    this.addEventListener('view:loaded', () => {
      // update title, status bar
      // auto-scroll to start/end of page based on direction, sync playlist selection
      this.updateBar()
      this.viewComponent.scrollToEnd(!this.#lastFlipRight)

      // sync selection to viewer if in playlist modde
      const fileExplorer = this.fileExplorer
      if (!fileExplorer.isHidden && fileExplorer.mode === 'playlist') fileExplorer.syncSelection()
    })
  }

  /**
   * Tab method, returns status bar object.
   */
  barStatus() {
    const currentFile = this.fileBook.currentFile
    const pageIdx = this.fileBook.page, pageCount = this.fileBook.files.length
    const filters = this.fileBook.filterQuery
    const barObj = {
      title: '',
      infoLeft: 'None',
      infoRight: '[0/0]',
      infoLeftFunc: null
    }

    if (pageCount) {
      const filterStr = filters.length ? `filter:${String(filters)}` : ''
      const imgMode = `fit-${this.viewComponent.mode}`
      const zoom = `${this.viewComponent.zoom.toFixed(0)}%`
      const pager = `[${pageIdx + 1}/${pageCount}]`

      barObj.infoLeft = currentFile.name
      barObj.infoRight = `${filterStr} ${imgMode}:${zoom} ${pager}`
      barObj.title = `${currentFile.name}`
      // copy filepath to clipboard
      barObj.infoLeftFunc = () => {
        navigator.clipboard.writeText(currentFile.path)
        AppNotifier.notify('filepath copied to clipboard')
      }
    }

    return barObj
  }

  /**
   * Update status bar with new contextual info when selected.
   */
  updateBar() {
    if (Tab.selectedTab.frame === this) StatusBar.updateStatus()
  }

  /**
   * Tab method, toggles Viewer play state.
   * @param {Boolean?} forceState Force play with `true` or pause with `false`.
   */
  mediaPlayToggle(forceState) {
    const isImg = this.viewComponent.fileType === 'image'

    if (isImg) this.viewComponent.slideshow.toggle(forceState, false)
    else this.viewComponent.media.playToggle(forceState)
  }
}

// define tags for web component templates
customElements.define(Viewer.tagName, Viewer)