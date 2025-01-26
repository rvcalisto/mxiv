import { ItemList } from "../../components/itemList.js";
import { appNotifier } from "../../components/notifier.js";


/**
 * @typedef {import("../../APIs/file/fileSearch.js").FileObject} FileObject
 */


/**
 * File explorer and playlist navigator.
 */
export class FileExplorer extends HTMLElement {

  static tagName = 'file-explorer';

  /**
   * Last populated object list cache.
   * @type {FileObject[]}
   */
  #explorerCache = [];

  /**
   * @type {FileObject}
   */
  #currentDirectoryFile;

  /**
   * @type {FileObject}
   */
  #parentDirectoryFile;

  /**
   * FileObjects from element references.
   * @type {WeakMap<HTMLElement, FileObject>}
   */
  #element2file = new WeakMap();

  /**
   * Prevent empty listing on first playlist presentation.
   */
  #playlistInitialized = false;

  /**
   * File item list.
   * @type {ItemList<FileObject, HTMLElement>}
   */
  #list;

  /**
   * @type {HTMLInputElement}
   */
  #searchPrompt;

  /**
   * Current directory path for Explorer mode.
   */
  currentDir = '~/';

  /** 
   * FileBook for playlist, set upstream.
   * @type {import('./fileBook.js').FileBook}
   */
  fileBook;

  /**
   * Presentation mode.
   * @type {'explorer'|'playlist'}
   */
  mode = 'explorer';

  #collator = new Intl.Collator('en', { numeric: true });

  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    const fragment = document.getElementById('fileExplorerTemplate').content;
    this.shadowRoot.append( fragment.cloneNode(true) );

    this.#searchPrompt = this.shadowRoot.getElementById('search');
    this.#list = this.shadowRoot.getElementById('itemList');

    this.style.display = 'none'; // starts hidden
    this.#initEvents();
    this.onblur();
  }

  /** 
   * Create item element from file object.
   * @param {FileObject} file
   * @returns {HTMLElement}
   */
  #createFileElement(file) {
    const element = document.createElement('p');
    element.setAttribute('icon', file.category);
    element.textContent = file.name;
    element.onclick = () => this.select(element);
    
    this.#element2file.set(element, file);
    
    return element;
  }

  /**
   * Update header elements.
   * @param {'explorer'|'playlist'} icon Icon to show.
   * @param {String} secondaryLabel De-emphasized label.
   * @param {String} primaryLabel Emphasized label.
   * @param {String} title Text on mouse hover.
   * @param {()=>void} [clickFunc] On click function.
   */
  #updateHeader(icon, secondaryLabel, primaryLabel, title, clickFunc) {
    const parentLabel = this.shadowRoot.getElementById('parentLabel');
    parentLabel.textContent = secondaryLabel;
    
    const currentLabel = this.shadowRoot.getElementById('currentLabel');
    currentLabel.textContent = primaryLabel;

    const header = this.shadowRoot.getElementById('header');
    header.toggleAttribute('passive', clickFunc == null);
    header.setAttribute('icon', icon);
    header.title = title;
    header.onclick = () => clickFunc ? clickFunc() : null;
  }

  /**
   * Change explorer directory. Cache results on success.
   * @param {string} path Directory path.
   * @returns {Promise<boolean>} Success
   */
  async #changeDirectory(path) {
    /** @type {import("../../APIs/file/fileSearch.js").LSObject} */
    const lsObj = await elecAPI.scanPath(path);
    
    // sort categories individually, then merge in order
    for (const key of ['directories', 'archives', 'files'])
      lsObj[key].sort( (fileA, fileB) => this.#collator.compare(fileA.path, fileB.path) );
    
    const directoryFiles = lsObj.directories.concat(lsObj.archives, lsObj.files);
    if (directoryFiles.length < 1) {
      appNotifier.notify(`${lsObj.target.name}: no supported files to list`, 'chdir');
      return false;
    }
    
    this.#explorerCache = directoryFiles;
    this.#parentDirectoryFile = lsObj.upperDir;
    this.#currentDirectoryFile = lsObj.target;
    this.currentDir = lsObj.target.path;
    return true;
  }

  #drawDirectory() {
    this.#updateHeader('explorer', 
      this.#parentDirectoryFile.name, this.#currentDirectoryFile.name, 
      this.#currentDirectoryFile.path, () => this.backOneFolder());

    this.#list.populate(this.#explorerCache, 
      item => this.#createFileElement(item), file => file.name[0] !== '.');
    
    this.toggleSearch(false);
    this.navItems();
  }

  #drawPlaylist() {
    this.#updateHeader('playlist', 'playlist', 
      this.fileBook.paths.map(i => i.name).toString(), 
      this.fileBook.paths.map(i => i.path).toString());

    this.#playlistInitialized = true;
    this.#list.populate(this.fileBook.files, 
      item => this.#createFileElement(item), file => file.name[0] !== '.');
    
    this.toggleSearch(false);
    this.syncSelection() || this.navItems();
  }

  /**
   * Draw list for current mode. Initialize cache if empty.
   */
  async #drawList() {
    if (this.mode === 'playlist')
      this.#drawPlaylist();
    else { 
      if (this.#explorerCache.length < 1)
        await this.#changeDirectory(this.currentDir);
      
      this.#drawDirectory();
    }
  }

  /**
   * Filter current list based on search query.
   */
  #filterList() {
    const workList = this.mode === 'playlist' ? this.fileBook.files : this.#explorerCache;
    const query = this.#searchPrompt.value.toLowerCase().trim();
    
    this.#list.populate(workList, (file) => this.#createFileElement(file), (file) => {
      const fileIsDot = file.name[0] === '.', queryIsDot = query[0] === '.';
      if (query === '')
        return !fileIsDot; // empty, match all but dot files
      
      const match = file.name.toLowerCase().includes(query);
      return fileIsDot ? match && queryIsDot : match;
    });
    
    this.#list.navItems(); // focus first item
  }

  /**
   * Sync selection with fileBook currently selected file.
   * @param {String} [filePath] Custom filepath to select instead.
   * @returns {Boolean} Success.
   */
  syncSelection(filePath) {
    filePath = filePath ?? (this.fileBook.currentFile?.path || '');
    
    const item = this.#list.findItemElement(item => filePath === item.path);
    if (!item)
      return false;
    
    this.#list.selectIntoFocus(item);
    return true;
  }

  scrollSelectionIntoView() {
    const selection = this.#list.getSelectedElement();
    selection?.scrollIntoView({ block: 'center' });
  }

  /**
   * Navigate and update list selection.
   * @param {'up'|'down'} [down='down'] Direction.
   */
  navItems(down = 'down') {
    const element = this.#list.navItems(down === 'down');
    element?.scrollIntoView({ block: 'center' });
  }

  /**
   * View selected media file or open selected folder.
   * @param {HTMLElement?} [element] 
   */
  select( element = this.#list.getSelectedElement() ) {
    if (element == null)
      return;
    
    this.#list.selectIntoFocus(element);
    const file = /** @type {FileObject} */ (this.#element2file.get(element));
    
    if (file.category === 'folder') {
      this.#changeDirectory(file.path)
        .then(success => success && this.#drawDirectory() );
    } else {
      const options = { composed: true, detail: file.path };
      this.dispatchEvent( new CustomEvent('fileExplorer:open', options) );
    }
  }

  /**
   * Goes to parent folder when in Explorer mode.
   */
  async backOneFolder() {
    if (this.mode !== 'explorer') 
      return;
    
    const previousDirectory = this.currentDir;
    await this.#changeDirectory(this.#parentDirectoryFile.path);
    
    this.#drawDirectory();
    this.syncSelection(previousDirectory);
  }

  /**
   * Invalidate caches, reload listings. Preserve selection.
   */
  async reload() {
    this.#playlistInitialized = false;
    this.#explorerCache = [];
    
    if ( !this.checkVisibility() )
      return; // hidden, skip reload after cache invalidation

    const previousElement = this.#list.getSelectedElement();
    const previousFile = previousElement ?
      this.#element2file.get(previousElement) : null;

    await this.#drawList();
    if (previousFile != null)
      this.syncSelection(previousFile.path);
  }

  /**
   * Toggle search prompt on/off.
   * @param {boolean} [show=true]
   */
  toggleSearch(show = true) {
    if (show) {
      this.#searchPrompt.style.display = '';
      this.#searchPrompt.focus();
    } else {
      this.#searchPrompt.value = '';
      this.#searchPrompt.style.display = 'none';
      
      if (this.mode === 'playlist')
        this.syncSelection();
    }
  }

  /**
   * Switch between playlist and explorer mode. Toggle if no mode is given.
   * Collapses/expand panel if request mode is current mode.
   * @param {'explorer'|'playlist'} [newMode] 
   */
  async toggleMode(newMode) {
    this.mode = newMode ?? (this.mode === 'explorer' ? 'playlist' : 'explorer');

    this.animate([{ filter: 'blur(10px)' }, { filter: 'blur(0px)' }], { duration: 150 });
    await this.#drawList();

    if ( !this.checkVisibility() )
      this.togglePanel(true);
    
    this.focus();
  }

  /**
   * Expand/collapses panel. Toggle by default.
   * @param {Boolean?} show Set visibility state instead of toggle.
   * @param {Number} duration Hide/show animation duration (ms).
   * @returns {Promise<true>} Promise that resolves at animation completion.
   */
  async togglePanel(show = !this.checkVisibility(), duration = 150) {
    if ( show === this.checkVisibility() )
      return true; // skip animation

    // populate list if uninitialized
    const isPlaylist = this.mode === 'playlist';
    const unitialized = isPlaylist ? !this.#playlistInitialized : this.#explorerCache.length < 1;
    if (show && unitialized)
      await this.#drawList();

    return new Promise(resolve => {
      this.style.display = '';
      if ( show && (isPlaylist || unitialized) )
        this.syncSelection();
      else if (show)
        this.scrollSelectionIntoView();

      this.animate([
        { width: '0px', minWidth: show ? '0px' : '' },
        { width: '0px', minWidth: show ? '' : '0px' }
      ], { duration: duration }).onfinish = () => {
        this.style.display = show ? '' : 'none'
        show ? this.focus() : this.blur()
        resolve(true);
      }
    });
  }

  checkVisibility() {
    return this.style.display === ''
  }

  #initEvents() {
    this.onblur = () => this.style.opacity = '.6';
    this.onfocus = () => this.style.opacity = '1';
    this.#searchPrompt.oninput = () => this.#filterList();
    
    // remove focus from search prompt, hide it if empty
    this.#searchPrompt.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === 'Escape' || e.key === 'Tab') {
        e.preventDefault();
        this.#searchPrompt.value.trim() === '' && this.toggleSearch(false);
        this.focus();
      }

      if (e.key === 'Backspace' && this.#searchPrompt.value.trim() === '') {
        e.stopImmediatePropagation();
        this.toggleSearch(false);
        this.focus();
      }
    }

    // bubble events as long as search prompt isn't focused
    this.onkeydown = (e) => {
      e.stopImmediatePropagation();
      if (this.shadowRoot.activeElement !== this.#searchPrompt)
        dispatchEvent( new CustomEvent('fileExplorerKeyEvent', { detail : e }) );
    }
  }
}

customElements.define(FileExplorer.tagName, FileExplorer);
