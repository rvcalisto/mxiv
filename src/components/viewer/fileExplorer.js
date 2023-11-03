import { ItemList } from "../../app/itemList.js"
import { AppNotifier } from "../../app/notifier.js";


/**
 * File explorer and playlist navigator.
 */
export class FileExplorer extends HTMLElement {

  static tagName = 'file-explorer'
  
  #playlistCache = []; #explorerCache = [] // cache for search

  /** Enclosing element. @type {HTMLElement} */
  #wrapper
  /** File item list. @type {ItemList} */
  #list
  /** Item search input. @type {HTMLInputElement} */
  #search

  constructor() {
    super()

    /** Set upstream.
     * @type {import('./viewer.js').Viewer} */
    this.viewer

    this.currentDir = '~/'
    this.upperDir = ''

    /** @type {'explorer'|'playlist'} */
    this.mode = 'explorer' // listing loaded files? else explorer mode
  }

  // called when tag appears in the DOM
  connectedCallback() {
    // attatch shadow root, append template
    this.attachShadow({mode: 'open'})
    const template = document.getElementById('fileExplorerTemplate')
    const fragment = template.content
    this.shadowRoot.append(fragment.cloneNode(true));

    // get properties
    this.#wrapper = this.shadowRoot.getElementById('wrapper')
    this.#search = this.shadowRoot.getElementById('search')

    /** @type {ItemList} */
    this.#list = this.shadowRoot.getElementById('itemList')

    // init input listeners and hide element
    this.#initEvents()
    this.style.display = 'none'
    this.onblur()
  }

  /** 
   * Returns file item element.
   * @param {import("../../APIs/fileAPI.js").FileObject} file 
   */
  #fileItem(file) {
    const item = document.createElement('p')
    item.textContent = file.name
    item.className = 'itemFont item'
    item.setAttribute('icon', file.category)
    item.filePath = file.path // to preserve selection on reload()

    item.onclick = () => {
      this.#list.selectIntoFocus(item)

      // change directory and return
      if (file.category === 'folder') {
        this.listDirectory(file.path)
        return
      }
  
      // signal filepath in custom event
      const event = new CustomEvent('fileExplorer:open', 
      { composed: true, detail: file.path  })
      this.dispatchEvent(event)
    }

    return item
  }

  /**
   * Update FileExplorer header elements.
   * @param {'explorer'|'playlist'} icon Icon to show.
   * @param {String} secondaryLabel De-empasized label.
   * @param {String} primaryLabel Emphasized label.
   * @param {String} title Text on mouse hover.
   * @param {()=>{}} clickFunc On click function.
   */
  #updateHeader(icon, secondaryLabel, primaryLabel, title, clickFunc) {
    const parentLabel = this.shadowRoot.getElementById('parDir')
    parentLabel.textContent = secondaryLabel
    
    const currentLabel = this.shadowRoot.getElementById('curDir')
    currentLabel.textContent = primaryLabel

    const header = this.shadowRoot.getElementById('dirBar')
    header.title = title
    header.onclick = clickFunc
    header.setAttribute('icon', icon)
  }

  /** List files in given path in explorer mode. */
  async listDirectory(path) {
    const ls = await elecAPI.fileAPI.lsAsync(path)
    const lsLength = ls.directories.length + ls.archives.length + ls.files.length

    if (!lsLength) {
      AppNotifier.notify(`${ls.target.name}: no supported files to list`, 'listDirectory')
      return
    }

    // else, list directory files
    this.currentDir = ls.target.path
    this.upperDir = ls.upperDir.path

    // update header elements
    this.#updateHeader('explorer', ls.upperDir.name, ls.target.name,
    path, () => this.backOneFolder())
  
    // sort first
    const coll = new Intl.Collator('en', {numeric: true})
    for (const key of ['directories', 'archives', 'files']) {
      ls[key].sort((fileA, fileB) =>
        coll.compare(fileA.path, fileB.path)
      )
    }

    // set mode, files and cache
    this.mode = 'explorer'
    const files = ls.directories.concat(ls.archives, ls.files)
    this.#explorerCache = files
    
    // populate in order (directories, archives & files)
    this.#list.populate(files, (item) => this.#fileItem(item),
    (file) => file.name[0] !== '.')

    // focus first item [can not be listed (dot files)]
    this.#list.navItems()

    // clear search
    this.toggleSearch(false)
  }

  /** List files from FileBook in playlist mode. */
  listFiles() {
    // update header elements
    const pathFileObjs = this.viewer.fileBook.paths
    this.#updateHeader('playlist', 'playlist', pathFileObjs.map((i) => i.name),
    pathFileObjs.map((i) => i.path), () => {})

    // set mode, files and cache
    this.mode = 'playlist'
    const files = this.viewer.fileBook.files
    this.#playlistCache = files
    
    // draw playlist, items will be tracked internally
    this.#list.populate(files, (item) => this.#fileItem(item),
    (file) => file.name[0] !== '.')

    // try selecting current file, else focus first item
    if ( !this.syncSelection() ) this.#list.navItems()
  
    // clear search
    this.toggleSearch(false)
  }

  /**
   * Sync item list selection with current fileBook file.
   * @param {String} filePath Custom filepath to select instead.
   * @returns {Boolean} Success.
   */
  syncSelection(filePath) {
    const currentFile = this.viewer.fileBook.currentFile
    // prefer given filePath, else use currentFile's. Use empty if undefined.
    filePath = filePath ? filePath : currentFile ? currentFile.path : ''
    const item = this.#list.findItemElement(item => filePath === item.path)

    if (!item) return false
    // else
    this.#list.selectIntoFocus(item)
    return true
  }

  /** Navigate list item selection. */
  navItems(down = 'down') {
    const element = this.#list.navItems(down === 'down')
    if (element) element.scrollIntoView({block:"center"})
  }

  /** Invoke click() method for currently selected list item. */
  select() {
    const selected = this.#list.pageContainerDiv.getElementsByClassName('selected')[0]
    if (selected) selected.click()
  }
  
  /** Goes to parent folder. Ignore if in playlist mode. */
  async backOneFolder() {
    if (this.mode === 'playlist') return

    const previousDir = this.currentDir
    await this.listDirectory(this.upperDir)
    this.syncSelection(previousDir)
  }

  /** Re-run mode procedure while keeping state. */
  async reload() {
    // avoid unecessary reload for not initiated FileExplorer
    const pageContainer = this.#list.pageContainerDiv
    if (this.isHidden && !pageContainer.childElementCount) return

    // reverse search #itemTable and discover selection path
    const selection = pageContainer.getElementsByClassName('selected')[0]
    const syncTo = selection ? selection.filePath : undefined
    
    // rebuild #list
    if (this.mode === 'playlist') this.listFiles()
    else await this.listDirectory(this.currentDir)

    // restore selection if any
    if (syncTo) this.syncSelection(syncTo)
  }

  /** Toggle search visibility. */
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

  /** Filter list items based on search query. */
  #searchQuery() {
    const workingArr = this.mode === 'playlist' ? this.#playlistCache : this.#explorerCache
    const query = this.#search.value
    
    // filter files
    this.#list.populate(workingArr, (item) => this.#fileItem(item),
    (file) => {
      const fileIsDot = file.name[0] === '.', queryIsDot = query[0] === '.'
      if (!query.trim()) return !fileIsDot

      const match = file.name.toLowerCase().includes(query.toLowerCase())
      return fileIsDot ? match && queryIsDot : match
    })
  
    // focus first item
    this.#list.navItems()
  }

  #initEvents() {
    // focus visual queue
    this.onblur = () => this.style.opacity = .6
    this.onfocus = () => this.style.opacity = 1

    // search items
    this.#search.oninput = () => this.#searchQuery()
    
    // remove focus / clear search
    this.#search.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === 'Escape' || e.key === 'Tab') {
        e.preventDefault()
        !this.#search.value ? this.toggleSearch(false) : this.#search.focus()
        this.focus()
      }

      // close search on empty backspace
      if (e.key === 'Backspace' && !this.#search.value.length) this.toggleSearch(false)
    }
    
    // capture unhandled keys on search focus, bubble otherwise
    this.onkeydown = (e) => {
      e.stopImmediatePropagation()
      const searchFocus = this.shadowRoot.activeElement === this.#search
      if (searchFocus) return

      const keyEvent = new CustomEvent('fileExplorerKeyEvent', {detail : e})
      dispatchEvent(keyEvent)
    }

  }

  /** Either host element is hidden (`display: none`). */
  get isHidden() {
    return this.style.display === 'none'
  }

  /**
   * Switch between playlist and explorer mode. Toggle if no mode is given.
   * Collapses/expand panel if request mode is current mode.
   * @param {'explorer'|'playlist'} [newMode] 
   */
  async toggleMode(newMode) {
    if (newMode === this.mode) return this.togglePanel()
    if (!newMode) newMode = this.mode === 'explorer' ? 'playlist' : 'explorer'

    this.#wrapper.animate([{ filter: 'blur(10px)' }, 
    { filter: 'blur(0px)' }], { duration: 150 })

    newMode === 'playlist' ? this.listFiles() : await this.listDirectory(this.currentDir)
    if (this.isHidden) this.togglePanel(true)
  }

  /**
   * Expand/collapses panel.
   * @param {Boolean?} show Set visibility state instead of toggle.
   * @param {Number} duration Hide/show animation duration (ms).
   * @returns {Promise<true>} Promise that resolves at animation completion.
   */
  async togglePanel(show = this.isHidden, duration = 150) {
    // if going to show a unpopulated panel, populate (first presentation)
    const populated = this.mode === 'playlist' ? this.#playlistCache.length : this.#explorerCache.length
    if (show && !populated) {
      this.mode === 'playlist' ? this.listFiles() : await this.listDirectory(this.currentDir)
      this.syncSelection()
    }

    // always sync selection for playlist
    if (this.mode === 'playlist') this.syncSelection()
    
    // resolve on enf of animation 
    return new Promise((resolve, reject) => {
      this.style.display = ''
      this.animate([
        { width: '0px', minWidth: show ? '0px' : '' },
        { width: '0px', minWidth: show ? '' : '0px' }
      ], {
        duration: duration
      }).onfinish = () => {
        this.style.display = show ? '' : 'none'
        this.isHidden ? this.blur() : this.focus()
        resolve(true)
      }
    })
  }
}

customElements.define(FileExplorer.tagName, FileExplorer)