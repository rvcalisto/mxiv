// @ts-check
import { GenericFrame } from "../genericFrame.js";
import { CoverGrid } from "./coverGrid.js";
import { WatchlistPanel } from "./watchlistPanel.js";
import userPreferences from "../../components/userPreferences.js";

import "./libraryActions.js";
import "./libraryAccelerators.js";


/**
 * @import { LibraryUpdate } from "../../APIs/library/main.js"
 */


/**
 * Composed book and archive library.
 */
export class Library extends GenericFrame {

  /**
   * Current Library frame instance, if connected.
   * @type {Library?}
   */
  static #singleInstanceRef = null;

  /**
   * Task status descriptor.
   */
  #taskStatus = '';

  /**
   * @type {WatchlistPanel}
   */
  watchlistPanel;

  /**
   * @type {CoverGrid}
   */
  coverGrid;

  // setup library progress listener
  static {
    userPreferences.events.observe('libraryItemsPerPage', (/** @type number */ value) => {
      const library = Library.#singleInstanceRef;

      if (library != null)
        library.coverGrid.setItemsPerPage(value);
    });

    userPreferences.events.observe('libraryCoverSize', (/** @type number */ size) => {
      const library = Library.#singleInstanceRef;

      if (library != null)
        library.coverGrid.setCoverSize(size);
    });

    elecAPI.onLibraryNew(async function handleUpdate(_e, /** @type {LibraryUpdate} */ update) {
      const library = Library.#singleInstanceRef;
      if (library == null)
        return;

      const { current, total, entries } = update;

      if (entries == null)
        library.#taskStatus = `Sync watchlist [${current}/${total}]`;
      else {
        library.coverGrid.updateCovers(entries);
        library.#taskStatus = `Generating thumbnails [${current}/${total}]`;
      }

      if (current === total)
        library.#taskStatus = '';

      library.refreshStatus();
    });
  }

  connectedCallback() {
    const template = /** @type HTMLTemplateElement */ (document.getElementById('libraryTemplate'));
    const fragment = template.content;
    
    const shadowRoot = this.attachShadow({ mode: 'open' });
    shadowRoot.append( fragment.cloneNode(true) );

    this.watchlistPanel = new WatchlistPanel(this);
    this.coverGrid = new CoverGrid(this);

    this.tabName = 'Library';
    this.#initEvents();

    Library.#singleInstanceRef = this;
  }

  disconnectedCallback() {
    Library.#singleInstanceRef = null;
  }

  /**
   * @override
   */
  onSelected() {
    const cover = this.coverGrid.selectedCover;

    if (cover)
      cover.scrollIntoView({ block: 'center' });
  }

  /**
   * @override
   */
  status() {
    const { itemCount, itemsPerPage, coverSize } = this.coverGrid.getInfo();

    return {
      title: 'Library',
      infoLeft: this.#taskStatus || 'Library',
      infoRight: `${itemsPerPage} @ ${coverSize} [${itemCount}]`
    }
  }

  /**
   * Sync library to watchlist, update covers.
   */
  async syncToWatchlist() {
    const watchItems = this.watchlistPanel.getItems();

    if ( watchItems.length > 0 && !await elecAPI.requestLock('library') )
      return;

    // prevent closing window while async population happens
    this.hold(true);

    console.time(`syncToWatchlist`);
    let addedPaths = await elecAPI.addToLibrary(watchItems);
    console.timeEnd(`syncToWatchlist`);

    this.notify(`${addedPaths} new book(s) added`, 'syncToWatchlist');

    // reload entries & generate thumbnails
    if (addedPaths > 0) {
      await this.coverGrid.reloadCovers();
      elecAPI.broadcast('library:sync');

      console.time('generateThumbnails');
      await elecAPI.updateLibraryThumbnails();
      console.timeEnd('generateThumbnails'); 

      elecAPI.broadcast('library:sync');
    }

    this.hold(false);
    await elecAPI.releaseLock('library');
  }

  /**
   * Add files to library. Not recursive. 
   * - Spawns file-dialog window if no files are given.
   * @param {string[]} files Filepaths to add to library
   */
  async addToLibrary(...files) {
    if ( !await elecAPI.requestLock('library') )
      return;

    this.hold(true);

    if (files.length < 1) {
      files = await elecAPI.dialog('open', {
        title: "Add Folder to Library",
        properties: ['openDirectory'],
        buttonLabel: "Add Selected"
      });
    }

    if (files != null && files.length > 0) {
      console.time(`addToLibrary`);
      const items = files.map(file => ({ path: file, recursive: false }));
      let addedPaths = await elecAPI.addToLibrary(items);
      console.timeEnd(`addToLibrary`);

      this.notify(`${addedPaths} new book(s) added`, 'addToLibrary');

      // reload entries & generate thumbnails
      if (addedPaths > 0) {
        await this.coverGrid.reloadCovers();
        elecAPI.broadcast('library:sync');

        console.time('generateThumbnails');
        await elecAPI.updateLibraryThumbnails();
        console.timeEnd('generateThumbnails'); 

        elecAPI.broadcast('library:sync');
      }
    }

    this.hold(false);
    await elecAPI.releaseLock('library');
  }

  /**
   * Remove entry from library.
   * @param {string} bookPath Entry path to remove.
   * @returns {Promise<boolean>} Success.
   */
  async removeFromLibrary(bookPath) {
    if ( !await elecAPI.requestLock('library') )
      return false;

    this.hold(true);
    const success = await elecAPI.removeFromLibrary(bookPath);

    if (success)
      elecAPI.broadcast('library:sync');

    this.hold(false);
    await elecAPI.releaseLock('library');

    return success;
  }

  /**
   * Remove all entries from library.
   * @returns {Promise<boolean>} Success.
   */
  async nukeLibrary() {
    if ( !await elecAPI.requestLock('library') )
      return false;

    this.hold(true);
    const success = await elecAPI.clearLibrary();

    if (success) {
      this.coverGrid.reloadCovers();
      elecAPI.broadcast('library:sync');
    }

    this.hold(false);
    await elecAPI.releaseLock('library');

    return success;
  }

  #initEvents() {
    const shadowRoot = /** @type ShadowRoot */ (this.shadowRoot);

    // add file to library using file-dialog
    const addBtn = /** @type HTMLElement */ (shadowRoot.getElementById('addBtn'));
    addBtn.onclick = () => this.addToLibrary();

    // open folder management
    const manageWatchlistBtn = /** @type HTMLElement */ (shadowRoot.getElementById('watchBtn'));
    manageWatchlistBtn.onclick = () => this.watchlistPanel.toggleVisibility(true);

    // sync watch folders
    const syncBtn = /** @type HTMLElement */ (shadowRoot.getElementById('syncBtn'));
    syncBtn.onclick = () => this.syncToWatchlist();

    // drag'n'drop into library
    const wrapper = /** @type HTMLElement */ (shadowRoot.getElementById('wrapper'));
    wrapper.ondrop = async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.dataTransfer != null) {
        const filepaths = Object.values(e.dataTransfer.files)
          .map( file => elecAPI.getPathForFile(file) );

        await this.addToLibrary(...filepaths);
      }
    };

    wrapper.ondragover = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    // populate cover grid
    this.coverGrid.drawCovers();
  }
}
