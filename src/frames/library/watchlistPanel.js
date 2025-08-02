import { GenericStorage } from "../../components/genericStorage.js";


/**
 * @typedef {{path:string, recursive:boolean}} WatchlistItem
 */


/**
 * Add and remove folders from watchlist.
 */
export class WatchlistPanel {

  /**
   * @type {GenericStorage<WatchlistItem>}
   */
  #storage = new GenericStorage('libraryWatch');

  /**
   * Background overlay element.
   * @type {HTMLElement}
   */
  #overlay;

  /**
   * Library shadowRoot reference.
   * @type {ShadowRoot}
   */
  #componentRoot;

  /**
   * @param {import("./library.js").Library} library Host component.
   */
  constructor(library) {
    this.#componentRoot = /** @type {ShadowRoot} */ (library.shadowRoot);
    this.#overlay = library.shadowRoot.querySelector('#wrapper .overlay');
    this.#initEvents();
  }

  /**
   * Returns either watch list panel is visibile.
   * @type {boolean}
   */
  get isVisible() {
    return this.#overlay.style.display == '';
  }

  /**
   * Get all items from Watchlist.
   * @returns {WatchlistItem[]}
   */
  getItems() {
    return this.#storage.values();
  }

  /**
   * Add a new watchlist item.
   * @param {string} path Watchlist item path.
   * @param {boolean} [recursive=true] Also sync child directories.
   */
  addItem(path, recursive = true) {
    this.#storage.set(path, {
      'path': path,
      'recursive': recursive
    });
    
    console.log(`added "${path}" to watchlist`);
  }

  /**
   * Update recursion option for watchlist item.
   * @param {string} path Watchlist item path.
   * @param {boolean} recursive New recursive value.
   */
  setRecursion(path, recursive) {
    const watchItem = this.#storage.get(path);

    if (watchItem) {
      watchItem.recursive = recursive;
      this.#storage.set(path, watchItem);
    }
  }

  /**
   * Remove watchlist item from watchlist.
   * @param {string} path Watchlist item path.
   * @returns {boolean} Success.
   */
  removeItem(path) {
    if ( this.#storage.get(path) == null )
      return false;

    this.#storage.delete(path);
    console.log(`removed "${path}" from watchlist`);
    return true;
  }

  /**
   * Draw list of folders to add to library on sync.
   */
  #drawList() {
    const folderList = this.#componentRoot.getElementById('folderList');
    folderList.textContent = ''; // clean list

    // populate list
    for ( const item of this.#storage.values() ) {
      const div = document.createElement('div');
      div.className = 'folderItem'
      div.innerHTML = `
        <p>${item.path}</p>
        <label title="evaluate subfolders"><input type="checkbox"">recursive</label>
        <button icon="close" title="remove from list"></button>`;

      folderList.appendChild(div);
      const recursiveCheck = div.getElementsByTagName('input')[0];
      const removeFolderBtn = div.getElementsByTagName('button')[0];

      // update recursion
      recursiveCheck.checked = item.recursive;
      recursiveCheck.oninput = () => {
        this.setRecursion(item.path, recursiveCheck.checked);
      };

      // remove path from list
      removeFolderBtn.onclick = () => {
        this.removeItem(item.path);
        this.#drawList();
      };
    }
  }

  /**
   * Toggle watch list visibilty.
   * @param {boolean} show Either to force visibilit on or off.
   * @param {number} duration Animation duration in ms.
   */
  toggleVisibility(show = !this.isVisible, duration = 150) {
    if (show === this.isVisible)
      return;

    if (show)
      this.#drawList();

    this.#overlay.style.display = '';
    this.#overlay.animate([
      { opacity: show ? 0 : 1 },
      { opacity: show ? 1 : 0 }
    ], {
      duration: duration
    }).onfinish = () => {
      this.#overlay.style.opacity = show ? '1' : '0';
      this.#overlay.style.display = show ? '' : 'none';
    };
  }

  #initEvents() {
    // exit folder management
    this.#overlay.onclick = (e) => {
      if (e.target == this.#overlay)
        this.toggleVisibility(false);
    };

    // add new folder to watchlist, open dialog
    const addtoBtn = this.#componentRoot.getElementById('addToWatch');
    addtoBtn.onclick = async () => {
      /** @type {string[]|undefined} */
      const files = await elecAPI.dialog('open', {
        title: "Add Folders to Watchlist",
        properties: ['openDirectory'],
        buttonLabel: "Add Selected"
      });

      if (files != null && files.length > 0) {
        files.forEach(file => this.addItem(file));
        this.#drawList();
      }
    };

    const closeBtn = this.#componentRoot.getElementById('closeWatchlist');
    closeBtn.onclick = () => this.toggleVisibility(false);
  }
}
