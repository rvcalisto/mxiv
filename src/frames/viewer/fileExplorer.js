import { ItemList } from "../../components/itemList.js"
import { AppNotifier } from "../../components/notifier.js";


/**
 * @typedef {import("../../APIs/file/fileSearch.js").FileObject} FileObject
 */


/**
 * File explorer and playlist navigator.
 */
export class FileExplorer extends HTMLElement {

  static tagName = 'file-explorer'
  
  /**
   * Last populated object list cache.
   * @type {FileObject[]}
   */
  #explorerCache = []

  /**
   * Prevent empty list if first presentation is in playlist mode.
   */
  #playlistSynced = false

  /**
   * File item list.
   * @type {ItemList<FileObject, HTMLElement>}
   */
  #list

  /**
   * File search prompt.
   * @type {HTMLInputElement}
   */
  #search

  /**
   * Parent diretory path for Explorer mode.
   * @type {String}
   */
  #upperDir = ''

  #collator = new Intl.Collator('en', { numeric: true })

  constructor() {
    super()

    /** 
     * FileBook host, set upstream.
     * @type {import('./viewer.js').Viewer}
     */
    this.viewer

    /**
     * Presentation mode.
     * @type {'explorer'|'playlist'}
     */
    this.mode = 'explorer'

    /**
     * Current directory path for Explorer mode.
     * @type {String}
     */
    this.currentDir = '~/'
  }

  connectedCallback() {
    // attatch shadow root, append template
    this.attachShadow({ mode: 'open' })
    const fragment = document.getElementById('fileExplorerTemplate').content
    this.shadowRoot.append( fragment.cloneNode(true) );

    // get properties
    this.#search = this.shadowRoot.getElementById('search')
    this.#list = this.shadowRoot.getElementById('itemList')

    // init input listeners and hide element
    this.#initEvents()
    this.style.display = 'none'
    this.onblur()
  }

  /** 
   * Returns file item element.
   * @param {FileObject} file 
   */
  #fileItem(file) {
    const item = document.createElement('p')
    item.setAttribute('icon', file.category)
    item.className = 'itemFont item'
    item.textContent = file.name
    item.filePath = file.path // to preserve selection on reload()

    item.onclick = () => {
      this.#list.selectIntoFocus(item)

      // list directory or open media
      if (file.category === 'folder') this.listDirectory(file.path)
      else {
        this.dispatchEvent( new CustomEvent('fileExplorer:open', {
          composed: true, detail: file.path 
        }))
      }
    }

    return item
  }

  /**
   * Update FileExplorer header elements.
   * @param {'explorer'|'playlist'} icon Icon to show.
   * @param {String} secondaryLabel De-empasized label.
   * @param {String} primaryLabel Emphasized label.
   * @param {String} title Text on mouse hover.
   * @param {()=>void} [clickFunc] On click function.
   */
  #updateHeader(icon, secondaryLabel, primaryLabel, title, clickFunc) {
    const parentLabel = this.shadowRoot.getElementById('parDir')
    parentLabel.textContent = secondaryLabel
    
    const currentLabel = this.shadowRoot.getElementById('curDir')
    currentLabel.textContent = primaryLabel

    const header = this.shadowRoot.getElementById('dirBar')
    header.setAttribute('icon', icon)
    header.onclick = () => { clickFunc ? clickFunc() : null }
    header.title = title
  }

  /** 
   * List files in given path in explorer mode.
   */
  async listDirectory(path) {
    /** @type {import("../../APIs/file/fileSearch.js").LSObject} */
    const lsObj = await elecAPI.scanPath(path)
    const count = lsObj.directories.length + lsObj.archives.length + lsObj.files.length
    if (count < 1) {
      AppNotifier.notify(`${lsObj.target.name}: no supported files to list`, 'listDirectory')
      return
    }

    this.currentDir = lsObj.target.path
    this.#upperDir = lsObj.upperDir.path

    // update header elements
    this.#updateHeader('explorer', lsObj.upperDir.name, 
      lsObj.target.name, path, () => this.backOneFolder() )
  
    // sort values
    for (const key of ['directories', 'archives', 'files']) {
      lsObj[key].sort( (fileA, fileB) =>
        this.#collator.compare(fileA.path, fileB.path)
      )
    }

    // order files (directories, archives & files), cache and populate list
    this.mode = 'explorer'
    this.#explorerCache = lsObj.directories.concat(lsObj.archives, lsObj.files)
    this.#list.populate(this.#explorerCache, 
      item => this.#fileItem(item), file => file.name[0] !== '.')

    // clear search, focus first item
    this.toggleSearch(false)
    this.#list.navItems()
  }

  /**
   * List files from FileBook in playlist mode.
   */
  listFiles() {
    // update header elements
    const pathFiles = this.viewer.fileBook.paths
    this.#updateHeader('playlist', 'playlist', 
      pathFiles.map(i => i.name).toString(), 
      pathFiles.map(i => i.path).toString())

    // draw playlist
    this.mode = 'playlist'
    this.#playlistSynced = true
    this.#list.populate(this.viewer.fileBook.files, 
      item => this.#fileItem(item), file => file.name[0] !== '.')

    // try selecting current file, else focus first item
    if ( !this.syncSelection() ) this.#list.navItems()
    this.toggleSearch(false)
  }

  /**
   * Sync selection with fileBook current page file.
   * @param {String} [filePath] Custom filepath to select instead.
   * @returns {Boolean} Success.
   */
  syncSelection(filePath) {
    const currentFile = this.viewer.fileBook.currentFile
    filePath = filePath || currentFile?.path || ''
    
    const item = this.#list.findItemElement(item => filePath === item.path)
    if (!item) return false
  
    this.#list.selectIntoFocus(item)
    return true
  }

  /**
   * Navigate list item selection.
   */
  navItems(down = 'down') {
    const element = this.#list.navItems(down === 'down')
    if (element) element.scrollIntoView({ block:"center" })
  }

  /**
   * View selected media file or open selected folder.
   */
  select() {
    const selected = this.#list.pageContainerDiv.getElementsByClassName('selected')[0]
    if (selected) selected.click()
  }
  
  /**
   * Goes to parent folder when in Explorer mode.
   */
  async backOneFolder() {
    if (this.mode === 'playlist') return

    const previousDir = this.currentDir
    await this.listDirectory(this.#upperDir)
    this.syncSelection(previousDir)
  }

  /**
   * Reload file listings while keeping selection.
   */
  async reload() {
    // avoid unecessary reload for uninitialized FileExplorer
    const pageContainer = this.#list.pageContainerDiv
    if (!this.isVisible && !pageContainer.childElementCount) return

    const path = pageContainer.getElementsByClassName('selected')[0]?.filePath
    
    if (this.mode === 'playlist') this.listFiles()
    else await this.listDirectory(this.currentDir)

    if (path) this.syncSelection(path)
  }

  /**
   * Toggle search prompt on/off.
   */
  toggleSearch(show = true) {
    if (show) {
      this.#search.style.display = ''
      this.#search.focus()
    } else {
      this.#search.value = ''
      this.#search.style.display = 'none'
      if (this.mode === 'playlist') this.syncSelection()
    }
  }

  /**
   * Filter list items based on search query.
   */
  #searchQuery() {
    const workList = this.mode === 'playlist' ? this.viewer.fileBook.files : this.#explorerCache
    const query = this.#search.value
    
    // filter files
    this.#list.populate(workList, (item) => this.#fileItem(item),
    (file) => {
      const fileIsDot = file.name[0] === '.', queryIsDot = query[0] === '.'
      if ( !query.trim() ) return !fileIsDot

      const match = file.name.toLowerCase().includes( query.toLowerCase() )
      return fileIsDot ? match && queryIsDot : match
    })
  
    // focus first item
    this.#list.navItems()
  }

  #initEvents() {
    // opacity on focus visual queue, search on input
    this.onblur = () => this.style.opacity = .6
    this.onfocus = () => this.style.opacity = 1
    this.#search.oninput = () => this.#searchQuery()
    
    // remove focus from, close search prompt
    this.#search.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === 'Escape' || e.key === 'Tab') {
        e.preventDefault()
        if (!this.#search.value) this.toggleSearch(false)
        this.focus()
      }

      // close search on empty backspace
      if (e.key === 'Backspace' && !this.#search.value.length) this.toggleSearch(false)
    }
    
    // bubble events as long as search prompt isn't focused
    this.onkeydown = (e) => {
      e.stopImmediatePropagation()
      if (this.shadowRoot.activeElement !== this.#search)
        dispatchEvent( new CustomEvent('fileExplorerKeyEvent', { detail : e }) )
    }
  }

  /**
   * Either FileExplorer panel is visible.
   */
  get isVisible() {
    return this.style.display === ''
  }

  /**
   * Switch between playlist and explorer mode. Toggle if no mode is given.
   * Collapses/expand panel if request mode is current mode.
   * @param {'explorer'|'playlist'} [newMode] 
   */
  async toggleMode(newMode) {
    if (newMode === this.mode) return this.togglePanel()
    if (!newMode) newMode = this.mode === 'explorer' ? 'playlist' : 'explorer'

    this.animate([{ filter: 'blur(10px)' }, { filter: 'blur(0px)' }], { duration: 150 })

    newMode === 'playlist' ? this.listFiles() : await this.listDirectory(this.currentDir)
    if (!this.isVisible) this.togglePanel(true)
  }

  /**
   * Expand/collapses panel. Toggle by default.
   * @param {Boolean?} show Set visibility state instead of toggle.
   * @param {Number} duration Hide/show animation duration (ms).
   * @returns {Promise<true>} Promise that resolves at animation completion.
   */
  async togglePanel(show = !this.isVisible, duration = 150) {
    if (show === this.isVisible) return true // skip animation

    // populate list on first presentation if not already
    const isPlaylist = this.mode === 'playlist'
    const populated = isPlaylist ? this.#playlistSynced : this.#explorerCache.length
    if (show && !populated) isPlaylist ? this.listFiles() : await this.listDirectory(this.currentDir)

    // resolve on end of animation or instantly if state hasn't changed
    return new Promise( (resolve, reject) => {
      this.style.display = ''
      if ( show && (isPlaylist || !populated) ) this.syncSelection()

      this.animate([
        { width: '0px', minWidth: show ? '0px' : '' },
        { width: '0px', minWidth: show ? '' : '0px' }
      ], {
        duration: duration
      }).onfinish = () => {
        this.style.display = show ? '' : 'none'
        show ? this.focus() : this.blur()
        resolve(true)
      }
    })
  }
}

customElements.define(FileExplorer.tagName, FileExplorer)