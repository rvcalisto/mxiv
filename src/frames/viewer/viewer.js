import { GenericFrame } from "../genericFrame.js"
import { FileBook } from "./fileBook.js"
import { FileExplorer } from "./fileExplorer.js"
import { View } from "../../components/view/view.js"

import "./viewerActions.js"
import "./viewerAccelerators.js"
import "./keyEventController.js"
import { AppNotifier } from "../../components/notifier.js"


/**
 * Composed File Explorer & Media Viewer component.
 */
export class Viewer extends GenericFrame {

  /**
   * Block go-to calls, prevents unloaded page flips.
   */
  #loading = false
  
  /**
   * Last Page flip direction for auto-scroll.
   */
  #lastFlipRight = true
  
  /**
   * Currently loaded paths for state replication.
   * @type {String[]}
   */
  #openArgs = []
    
  /**
   * File paginator and controller.
   * @type {FileBook}
   */
  fileBook

  /**
   * Multimedia viewer.
   * @type {View}
   */
  viewComponent

  /**
   * File explorer and playlist visualizer.
   * @type {FileExplorer}
   */
  fileExplorer

  /**
   * Filter words.
   * @type {string[]}
   */
  #filterQuery = []


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

      paths: this.#openArgs,

      filterQuery: this.#filterQuery,
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

    // don't autoplay if restoring audio/video
    this.viewComponent.autoplay = this.viewComponent.fileType === 'image'

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
    this.#openArgs = paths

    if ( !await this.fileBook.load(...paths) ) {
      AppNotifier.notify('no files to open', 'viewer:open')
      return
    }

    // name tab path basenames, sorted for order-redundancy
    const basedirs = this.fileBook.paths.map(dir => dir.name)
    this.renameTab( String(basedirs) )

    this.gotoPage()
    this.fileExplorer.reload()
  }

  /**
   * Find and present file with matching filepath substrings. 
   * @param {String[]} queries File name or substring to find.
   */
  find(...queries) {
    queries = queries.map( query => query.toLowerCase().trim() )
      .filter(query => query !== '')

    const idx = this.fileBook.getIdxOf(file => {
      const pathLowerCase = file.path.toLowerCase()
      return queries.every( query => pathLowerCase.includes(query) )
    })

    idx < 0 ? AppNotifier.notify('no matches') : this.gotoPage(idx)
  }

  /**
   * Filter files by partial words and tags. Clear if none provided.
   * @param {String[]} [queries] Tags and substrings to filter for.
   */
  filter(...queries) {
    queries = queries.map( query => query.toLowerCase().trim() )
      .filter(query => query !== '')

    if (queries.length < 1) {
      this.fileBook.clearFilter()
      this.#filterQuery = []
      AppNotifier.notify('clear filter')
    } else {
      const currentFilePath = this.fileBook.currentFile?.path
  
      const matches = this.fileBook.filterStringAndTags(...queries)
      if (matches === 0) return AppNotifier.notify('no matches')
      else this.#filterQuery = queries
  
      // new filter exclude currentFile, refresh
      if (currentFilePath !== this.fileBook.currentFile?.path) 
        this.gotoPage();

      AppNotifier.notify(`${matches} files matched`)
    }

    // update status bar and reload fileExplorer
    this.refreshStatus()
    this.fileExplorer.reload()
  }

  /**
   * Present next page.
   * @param {Boolean} [forward=true] Flip to the right.
   */
  flipPage(forward = true) {
    this.#lastFlipRight = forward
    this.gotoPage(this.fileBook.page + (forward ? 1 : -1))
  }

  /**
   * Display media at current or specific index if given. 
   * @param {Number} [pageIdx]
   */
  async gotoPage(pageIdx = this.fileBook.page) {
    if (this.fileBook.files.length < 1) {
      this.viewComponent.display(null)
      return
    }

    // block until resolve
    if (this.#loading) return
    this.#loading = true

    // get right file, set openArgs
    const file = this.fileBook.setPageIdx(pageIdx)
    const paths = this.fileBook.paths.map(dir => dir.path)
    this.#openArgs = [file.path, ...paths] 

    // wait for display (loaded) and resolve block
    const fileURL = elecAPI.getFileURL(file.path)
    let success = await this.viewComponent.display(fileURL, file.category)
    this.#loading = false
    
    if (!success) {
      console.log('Failed to load resource. Delist file and skip.')
      this.fileBook.delistFile(file)
      this.gotoPage()
    }
  }

  /**
   * Display random file in fileBook.
   */
  gotoRandom() {
    this.fileBook.setRandomPageIdx()
    this.gotoPage()
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

    const paths = this.fileBook.paths.map(dir => dir.path)
    const tabName = this.tabName

    // re-open current paths, starting by current-file
    AppNotifier.notify('reloading files...', 'fileReload')
    await this.open(currentFile.path, ...paths)

    // restore tab name and re-apply filter
    this.renameTab(tabName)
    if (this.#filterQuery.length) this.filter(...this.#filterQuery)
    AppNotifier.notify('files reloaded', 'fileReload')
  }

  /**
   * Run user defined script on current file.
   * @param {String} userScript User script.
   * @returns {Promise<boolean>} Either command was run or not.
   */
  async runOnPage(userScript) {
    const currentFile = this.fileBook.currentFile
    const success = await elecAPI.runOnFile(userScript, currentFile)
    if (success) console.log(`Ran user script:`, {
      script: userScript,
      file: currentFile
    })
    
    return success
  }
  
  /**
   * Delete current file from filesystem.
   */
  async deletePage() {
    const targetFile = this.fileBook.currentFile
    if (!targetFile) return AppNotifier.notify('no loaded file to delete', 'pageDel')
    
    const forReal = confirm(`Permanently delete current file:\n${targetFile.name}?`)
    if (!forReal) return

    // try and delete target file from filesystem
    const success = await elecAPI.deleteFile(targetFile.path)
    if (success) {
      this.fileBook.delistFile(targetFile)
      await this.gotoPage()
      await this.fileExplorer.reload()
      this.fileExplorer.syncSelection()
    }

    const message = `${success ? 'deleted' : 'failed to delete'} ${targetFile.path}`
    console.log(message)
    AppNotifier.notify(message)
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
      const filepath = e.detail
      const fileIdx = this.fileBook.getIdxOf(file => file.path === filepath)

      fileIdx > -1 ? this.gotoPage(fileIdx) : this.open(filepath)
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
    
    const { files, page, currentFile } = this.fileBook
    if (files.length) {
      const filterInfo = this.#filterQuery.length ? `filter:${this.#filterQuery}` : ''
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

  /**
   * @override
   * @param {'play'|'pause'|'stop'|'next'|'previous'} action 
   */
  mediaControl(action) {
    const isImg = this.viewComponent.fileType === 'image'

    switch (action) {
      case 'play':
        if (!isImg) this.viewComponent.media.playToggle(true)
        break
      case 'pause': case 'stop':
        if (isImg) this.viewComponent.slideshow.toggle(false, false)
        else this.viewComponent.media.playToggle(false)
        break
      case 'next': case 'previous':
        if (!isImg) this.flipPage(action === 'next')
        break
    }
  }
}
