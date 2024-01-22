import { AppNotifier } from "../../app/notifier.js";


/**
 * Add and remove folders from watchlist.
 */
export class WatchlistPanel {

  #watchlistStorage = 'libraryWatch';

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
    this.#componentRoot = library.shadowRoot;
    this.#overlay = library.shadowRoot.getElementById('wrapper').getElementsByClassName('overlay')[0];
    this.#initEvents();
  }

  /**
   * Returns either watch list panel is visibile.
   * @type {Boolean}
   */
  get isVisible() {
    return this.#overlay.style.display == '';
  }

  /**
   * @typedef {{path:string, recursive:boolean}} WatchlistItem
   */

  /**
   * Get all paths in watchlist.
   * @returns {Object<string, WatchlistItem>}
   */
  getWatchObject() {
    const watchObj = JSON.parse( localStorage.getItem(this.#watchlistStorage) );
    return watchObj ? watchObj : {};
  }

  /**
   * Store watchlist items object.
   * @param {Object<string, WatchlistItem>} watchObject Watchlist object.
   */
  #storeWatchObject(watchObject) {
    localStorage.setItem( this.#watchlistStorage, JSON.stringify(watchObject) );
  }

  /**
   * Add folder path from watchlist.
   * @param {String} folder Path to folder.
   */
  addPath(folder) {
    let watchObj = this.getWatchObject();

    watchObj[folder] = {
      'path': folder,
      'recursive': true
    };

    this.#storeWatchObject(watchObj);
    console.log(`added ${folder} to watchlist`);
  }

  /**
   * Update recursion option for watchlist item.
   * @param {String} pathKey WatchlistItem path.
   * @param {Boolean} recursive New recursive value.
   */
  setRecursion(pathKey, recursive) {
    let watchObj = this.getWatchObject();

    watchObj[pathKey].recursive = recursive;
    this.#storeWatchObject(watchObj);
  }

  /**
   * Remove watchlist item from watchlist.
   * @param {String} itemPath Path to item.
   */
  removePath(itemPath) {
    const watchObj = this.getWatchObject();
    if (!watchObj || !watchObj[itemPath])
      return AppNotifier.notify(`no ${itemPath} in watchlist to remove`);

    delete watchObj[itemPath];
    this.#storeWatchObject(watchObj);
    console.log(`removed ${itemPath} from watchlist`);
  }

  /**
   * Draw list of folders to add to library on sync.
   */
  #drawList() {
    const folderList = this.#componentRoot.getElementById('folderList');
    folderList.textContent = ''; // clean list

    // populate list
    for (const item of Object.values(this.getWatchObject())) {
      const div = document.createElement('div');
      div.innerHTML = `
      <div class="folderItem">
        <p>${item.path}</p>
        <p title="evaluate subfolders">recursive<input type="checkbox""></p>
        <button>remove folder</button>
      </div>`;

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
        this.removePath(item.path);
        this.#drawList();
      };
    }
  }

  /**
   * Toggle watch list visibilty.
   * @param {Boolean} show Either to force visibilit on or off.
   * @param {Number} duration Animation duration in ms.
   */
  toggleVisibility(show = true, duration = 150) {
    if (show) this.#drawList();

    this.#overlay.style.display = '';
    this.#overlay.animate([
      { opacity: show ? 0 : 1 },
      { opacity: show ? 1 : 0 }
    ], {
      duration: duration
    }).onfinish = () => {
      this.#overlay.style.opacity = show ? 1 : 0;
      this.#overlay.style.display = show ? '' : 'none';
    };
  }

  #initEvents() {
    // exit folder management
    this.#overlay.onclick = (e) => {
      if (e.target != this.#overlay) return;
      this.toggleVisibility(false);
    };

    // add new folder to watchlist, open dialog
    const addtoBtn = this.#componentRoot.getElementById('addToWatch');
    addtoBtn.onclick = async () => {
      const files = await elecAPI.dialog({
        title: "Add to Watchlist",
        properties: ['multiSelections'], // 'openDirectory' invalidates archives
        buttonLabel: "Add Selected",
        filters: [
          { name: 'Folders', extensions: ['*'] },
          { name: 'Archives', extensions: ['zip', 'cbz'] }
        ]
      });

      if (!files) return;
      files.forEach(file => this.addPath(file));
      this.#drawList();
    };
  }
}