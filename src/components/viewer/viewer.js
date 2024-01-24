import { GenericFrame } from "../../tabs/genericFrame.js"
import { FileBook } from "./fileBook.js"
import { FileExplorer } from "./fileExplorer.js"
import { View } from "../view/view.js"

import "./viewerActions.js"
import "./viewerAccelerators.js"
import "./keyEventController.js"
import { AppNotifier } from "../../app/notifier.js"


/**
 * Composed File Explorer & Media Viewer component.
 */
export class Viewer extends GenericFrame {

  static tagName = 'viewer-component'

  /**
   * Block go-to calls, prevents unloaded page flips.
   */
  #loading = false
  
  /**
   * Last Page flip direction for auto-scroll.
   */
  #lastFlipRight = true
  
  constructor() {
    super()

    /**
     * Currently loaded paths for state replication.
     * @type {String[]}
     */
    this.openArgs = []
    
    /**
     * File paginator and controller.
     * @type {FileBook}
     */
    this.fileBook

    /**
     * Multimedia viewer.
     * @type {View}
     */
    this.viewComponent

    /**
     * File explorer and playlist visualizer.
     * @type {FileExplorer}
     */
    this.fileExplorer
  }

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
  }

  disconnectedCallback() {
    this.fileBook.closeBook()
  }

  /** @override */
  getState() {
    return {
      tabName: this.tabName,

      paths: this.openArgs,

      filterQuery: this.fileBook.filterQuery,
      mediaState: this.viewComponent.state(),

      fileExplorer: {
        dir: this.fileExplorer.currentDir,
        mode: this.fileExplorer.mode,
        show: this.fileExplorer.isVisible
      },
    }
  }

  /** @override */
  async restoreState(stateObj) {
    // open path on file
    if (stateObj.paths.length) await this.open(...stateObj.paths)
    if (stateObj.tabName) this.renameTab(stateObj.tabName)
    
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
   * Load files and directories, sync fileExplorer and display first file.
   * @param {String[]} paths Paths. Will display first path if file.
   */
  async open(...paths) {
    // Prevents state replication failure when duplicating while loading
    this.openArgs = paths
    const startIdx = await this.fileBook.load(...paths)
    if (startIdx < 0) {
      AppNotifier.notify('no files to open', 'viewer:open')
      return
    }

    // name tab path basenames, sorted for order-redundancy
    const basedirs = this.fileBook.paths.map(dir => dir.name)
    this.renameTab( String(basedirs) )

    this.gotoPage(startIdx)
    this.fileExplorer.reload()
  }

  /**
   * Find and present file with matching filepath substrings. 
   * @param {String[]} queries File name or substring to find.
   */
  find(...queries) {
    const idx = this.fileBook.getIdxOf(...queries)
    if (idx > -1) this.gotoPage(idx)
    else AppNotifier.notify('no matches')
  }

  /**
   * Filter files by partial words and tags.
   * @param  {String[]} queries Tags and substrings to filter for.
   */
  filter(...queries) {
    const currentFilePath = this.fileBook.currentFile?.path

    const matches = this.fileBook.filter(...queries)
    if (matches === 0) return AppNotifier.notify('no matches')

    // new filter exclude currentFile, refresh
    if (this.fileBook.getIdxOf(currentFilePath) < 0) this.gotoPage(this.fileBook.page)

    // update status bar and reload fileExplorer
    this.refreshStatus()
    this.fileExplorer.reload()
    AppNotifier.notify(matches > 0 ? `${matches} files matched` : 'clear filter')
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
    const fileURL = elecAPI.fileAPI.getFileURL(file.path)
    let success = await this.viewComponent.display(fileURL, file.category)
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
    const fileCount = this.fileBook.files.length
    let randomIdx = Math.floor( Math.random() * fileCount )
    
    // flip if ~2 files, re-roll if randomIdx === current page
    if (fileCount < 3) return this.gotoPage(this.fileBook.page + 1)
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
    const tabName = this.tabName

    // re-open current paths, starting by current-file
    AppNotifier.notify('reloading files...', 'fileReload')
    await this.open(currentFile.path, ...paths)

    // restore tab name and re-apply filter
    this.renameTab(tabName)
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

    // update explorer and display suggested page
    this.fileExplorer.reload()
    this.gotoPage(equivalentIdx)
    AppNotifier.notify('removed ' + currentFile.path)
  }

  /**
   * Toggle fullscreen and hide/show FileExplorer accordingly.
   */
  async toggleFullscreen() {
    // using electron to keep components other than the target visible. 
    const isFullscreen = await elecAPI.toggleFullscreen()
    
    if (isFullscreen) {
      this.fileExplorerWasOpen = this.fileExplorer.isVisible
      await this.fileExplorer.togglePanel(false)
    }
    else if (this.fileExplorerWasOpen) {
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
    this.addEventListener('view:playing', (e) => this.setFrameIsPlaying(e.detail))
    this.addEventListener('view:next', () => this.flipPage())
    this.addEventListener('view:random', () => this.gotoRandom())
    this.addEventListener('view:previous', () => this.flipPage(false))
    this.addEventListener('view:mode', () => this.refreshStatus())
    this.addEventListener('view:zoom', () => this.refreshStatus())
    this.addEventListener('view:fullscreen', () => this.toggleFullscreen())
    this.addEventListener('view:loaded', () => {
      // refresh status, auto-scroll to start/end of page based on direction
      this.refreshStatus()
      this.viewComponent.scrollToEnd(!this.#lastFlipRight)

      // sync selection to viewer if in playlist modde
      const fileExplorer = this.fileExplorer
      if (fileExplorer.isVisible && fileExplorer.mode === 'playlist') fileExplorer.syncSelection()
    })
  }

  /** @override */
  status() {
    const status = {
      title: '',
      infoLeft: 'None',
      infoRight: '[0/0]',
      infoLeftFunc: null
    }
    
    const { files, page, currentFile, filterQuery } = this.fileBook
    if (files.length) {
      const filterInfo = filterQuery.length ? `filter:${filterQuery}` : ''
      const pager = `[${page + 1}/${files.length}]`
      const { mode, zoom } = this.viewComponent

      status.title = currentFile.name
      status.infoLeft = currentFile.name
      status.infoRight = `${filterInfo} fit-${mode}:${zoom.toFixed(0)}% ${pager}`
      status.infoLeftFunc = () => {
        navigator.clipboard.writeText(currentFile.path)
        AppNotifier.notify('filepath copied to clipboard')
      }
    }

    return status
  }

  /** @override */
  mediaPlayToggle(forceState) {
    const isImg = this.viewComponent.fileType === 'image'

    if (isImg) this.viewComponent.slideshow.toggle(forceState, false)
    else this.viewComponent.media.playToggle(forceState)
  }
}

// define tags for web component templates
customElements.define(Viewer.tagName, Viewer)