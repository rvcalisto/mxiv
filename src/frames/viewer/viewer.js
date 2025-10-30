// @ts-check
import { GenericFrame } from "../genericFrame.js";
import { FileBook } from "./fileBook.js";
import { FileExplorer } from "./fileExplorer.js";
import { View } from "../../components/view/view.js";

import "./viewerActions.js";
import "./viewerAccelerators.js";
import "./keyEventController.js";


/**
 * Composed File Explorer & Media Viewer component.
 */
export class Viewer extends GenericFrame {

  /**
   * Block new open calls until book resolves.
   */
  #bookIsLoading = false;

  /**
   * Block go-to calls, prevents unloaded page flips.
   */
  #pageIsLoading = false;
  
  /**
   * Last Page flip direction for auto-scroll.
   */
  #lastFlipRight = true;
  
  /**
   * Currently loaded paths for state replication.
   * @type {string[]}
   */
  #openArgs = [];
    
  /**
   * File paginator and controller.
   * @type {FileBook}
   */
  fileBook;

  /**
   * Multimedia viewer.
   * @type {View}
   */
  viewComponent;

  /**
   * File explorer and playlist visualizer.
   * @type {FileExplorer}
   */
  fileExplorer;

  /**
   * Filter words.
   * @type {string[]}
   */
  #filterQuery = [];


  connectedCallback() {
    // clone template content into shadow root
    const template = /** @type HTMLTemplateElement */ (document.getElementById('viewerTemplate'));
    const shadowRoot = this.attachShadow({ mode: 'open' });
    shadowRoot.append( template.content.cloneNode(true) );

    // composition instances
    this.fileBook = new FileBook();
    this.viewComponent = /** @type {View}        */ (shadowRoot.getElementById('viewInstance'));
    this.fileExplorer = /** @type {FileExplorer} */ (shadowRoot.getElementById('fileExplorer'));
    this.fileExplorer.fileBook = this.fileBook;

    this.#initEvents();
  }

  disconnectedCallback() {
    this.fileBook.closeBook();
  }

  /**
   * @override
   */
  getState() {
    return {
      tabName: this.tabName,
      paths: this.#openArgs,
      filterQuery: this.#filterQuery,
      mediaState: this.viewComponent.state(),

      fileExplorer: {
        dir: this.fileExplorer.currentDir,
        mode: this.fileExplorer.mode,
        show: this.fileExplorer.checkVisibility()
      }
    };
  }

  /**
   * @override
   * @param {*} stateObj Viewer state object.
   */
  async restoreState(stateObj) {
    // load state and disable autoplay when restoring/duplicating
    this.viewComponent.state(stateObj.mediaState);
    this.viewComponent.autoplay = false;
    
    // open paths and goto file
    if (stateObj.paths.length)
      await this.open(...stateObj.paths);

    // enable autoplay for next media onwards
    this.viewComponent.autoplay = true; 

    if (stateObj.tabName)
      this.tabName = stateObj.tabName;

    // re-apply filter (idx based, file order/count may have changed)
    if (stateObj.filterQuery.length)
      this.filter(...stateObj.filterQuery);

    // pass fileExplorer parameters
    this.fileExplorer.currentDir = stateObj.fileExplorer.dir;
    this.fileExplorer.mode = stateObj.fileExplorer.mode;
    if (stateObj.fileExplorer.show)
      this.fileExplorer.togglePanel(true);
  }

  /** 
   * Load files and directories, sync fileExplorer and display first file.
   * - Clear filter and filter queries.
   * @param {string[]} paths Paths. Will display first path if file.
   */
  async open(...paths) {
    if (this.#bookIsLoading)
      return;

    this.hold(true);
    this.#bookIsLoading = true;
    this.#openArgs = paths; // fix state replication (duplicates) during bookIsLoading

    if ( !await this.fileBook.load(...paths) ) {
      this.notify('no files to open', 'viewer:open');
    } else {
      // reset filter query
      this.#filterQuery = [];

      // name tab path basenames, sorted for order-redundancy
      const basedirs = this.fileBook.paths.map(dir => dir.name);
      this.tabName = String(basedirs);

      await this.gotoPage();
      this.fileExplorer.reload();
    }

    this.#bookIsLoading = false;
    this.hold(false);
  }

  /**
   * Find and present next file with matching name substrings. 
   * @param {string[]} queries File name or substring to find.
   */
  find(...queries) {
    const treatedQueries = queries
      .map( query => query.toLowerCase().trim() )
      .filter(query => query !== '');

    /** @param {import('../../APIs/file/fileSearch.js').FileObject} file */
    const matchFile = (file) => {
      const name = file.name.toLowerCase();
      return treatedQueries.every( query => name.includes(query) );
    };

    const startIdx = this.fileBook.page + 1;
    const nextFiles = this.fileBook.files.slice(startIdx);
    let idx = nextFiles.findIndex(matchFile);

    if (idx > -1)
      idx += startIdx; // correct offset
    else {
      const previousFiles = this.fileBook.files.slice(0, startIdx);
      idx = previousFiles.findIndex(matchFile);
    }

    idx < 0
      ? this.notify('no matches', 'find')
      : this.gotoPage(idx);
  }

  /**
   * Filter files by partial words and tags. Clear if none provided.
   * @param {string[]} queries Tags and substrings to filter for.
   */
  filter(...queries) {
    queries = queries.map( query => query.toLowerCase().trim() )
      .filter(query => query !== '');

    if (queries.length < 1) {
      this.fileBook.clearFilter();
      this.#filterQuery = [];
      this.notify('clear filter');
    } else {
      const currentFilePath = this.fileBook.currentFile?.path;
      const matches = this.fileBook.filterStringAndTags(...queries);
  
      if (matches === 0)
        return this.notify('no matches');
      else
        this.#filterQuery = queries;
  
      // new filter exclude currentFile, refresh
      if (currentFilePath !== this.fileBook.currentFile?.path) 
        this.gotoPage();

      this.notify(`${matches} files matched`);
    }

    // update status bar and reload fileExplorer
    this.refreshStatus();
    this.fileExplorer.reload();
  }

  /**
   * Present next page.
   * @param {boolean} [forward=true] Flip to the right.
   */
  flipPage(forward = true) {
    this.#lastFlipRight = forward;
    this.gotoPage(this.fileBook.page + (forward ? 1 : -1));
  }

  /**
   * Display media at current or specific index if given. 
   * @param {number} [pageIdx]
   */
  async gotoPage(pageIdx = this.fileBook.page) {
    if (this.fileBook.files.length < 1) {
      this.viewComponent.display(null, 'image');
      this.tabName = 'tab';
      return;
    }

    // block until resolve
    if (this.#pageIsLoading)
      return;

    this.#pageIsLoading = true;

    // get right file, set openArgs
    const file = this.fileBook.setPageIdx(pageIdx);
    if (file == null)
      return;

    const paths = this.fileBook.paths.map(dir => dir.path);
    this.#openArgs = [file.path, ...paths];

    // wait for display (loaded) and resolve block
    const fileURL = elecAPI.getFileURL(file.path);
    let success = await this.viewComponent.display(fileURL, file.category);
    this.#pageIsLoading = false;
    
    if (!success) {
      console.log('Failed to load resource. Delist file and skip.');
      this.fileBook.delistFile(file);
      this.gotoPage();
    }
  }

  /**
   * Display random file in fileBook.
   */
  gotoRandom() {
    this.fileBook.setRandomPageIdx();
    this.gotoPage();
  }

  /**
   * Reload fileBook and fileExplorer while keeping current state.
   */
  async reload() {
    const currentFile = this.fileBook.currentFile;
    if (!currentFile) {
      this.fileExplorer.reload();
      this.notify('reloaded fileExplorer', 'fileReload');
      return;
    }

    const filterQuery = this.#filterQuery;
    const paths = this.fileBook.paths.map(dir => dir.path);
    const tabName = this.tabName;

    // re-open current paths, starting by current-file
    this.notify('reloading files...', 'fileReload');
    await this.open(currentFile.path, ...paths);

    // restore tab name and re-apply filter
    this.tabName = tabName;
    if (filterQuery.length > 0)
      this.filter(...filterQuery);

    this.notify('files reloaded', 'fileReload');
  }
  
  /**
   * Delete current file from filesystem.
   */
  async deletePage() {
    const targetFile = this.fileBook.currentFile;
    if (!targetFile)
      return this.notify('no loaded file to delete', 'pageDel');

    const answerID = await elecAPI.dialog('message', {
      type: 'question',
      title: 'Delete File',
      message: `Permanently delete current file?`,
      detail: targetFile.name,
      buttons: ['Delete', 'Cancel'],
      defaultId: 0,
      cancelId: 1
    });

    if (answerID === 1)
      return;

    // try and delete target file from filesystem
    const filterState = this.fileBook.isFiltered();
    const success = await elecAPI.deleteFile(targetFile.path);
    if (success) {
      this.fileBook.delistFile(targetFile);

      // clear #filterQuery if filter cleared on delist
      if ( filterState !== this.fileBook.isFiltered() )
        this.#filterQuery = [];

      await this.gotoPage();
      await this.fileExplorer.reload();
      this.fileExplorer.syncSelection();
    }

    const message = `${success ? 'deleted' : 'failed to delete'} ${targetFile.path}`;
    console.log(message);
    this.notify(message);
  }

  /**
   * Toggle fullscreen and hide/show FileExplorer accordingly.
   */
  async toggleFullscreen() {
    // using electron to keep components other than the target visible. 
    const isFullscreen = await elecAPI.toggleFullscreen();
    
    if (isFullscreen) {
      this.fileExplorerWasOpen = this.fileExplorer.checkVisibility();
      await this.fileExplorer.togglePanel(false);
    } else if (this.fileExplorerWasOpen) {
      await this.fileExplorer.togglePanel(!isFullscreen);
      this.fileExplorer.blur();
    }
  }
  
  /**
   * @inheritdoc
   */
  onSelected() {
    this.fileExplorer.scrollSelectionIntoView();
  }
  
  /**
   * Setup event listeners.
   */
  #initEvents() {
    const shadowRoot = /** @type ShadowRoot */ (this.shadowRoot);
    const explorerBtn = /** @type {HTMLElement} */ (shadowRoot.querySelector('#explorerBtn'));
    const playlistBtn = /** @type {HTMLElement} */ (shadowRoot.querySelector('#playlistBtn'));

    const togglePanelMode = (/** @type {'explorer'|'playlist'}*/ mode) => {
      if (this.fileExplorer.mode !== mode)
        this.fileExplorer.toggleMode(mode);
      else
        this.fileExplorer.togglePanel();
    };

    explorerBtn.onclick = () => togglePanelMode('explorer');
    playlistBtn.onclick = () => togglePanelMode('playlist');

    const viewComponent = this.viewComponent;

    // drag'n'drop
    viewComponent.ondrop = (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.dataTransfer != null) {
        const filepaths = Object.values(e.dataTransfer.files)
          .map( file => elecAPI.getPathForFile(file) );

        this.open(...filepaths);
      }
    };

    // needed for drop event
    viewComponent.ondragover = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    // flip image depending on the click position
    viewComponent.oncontextmenu = (e) => {
      if (viewComponent.fileType !== 'image')
        return;

      const forward = e.offsetX >= viewComponent.clientWidth / 2;
      this.flipPage(forward);
    };

    // fileBook events
    this.addEventListener('fileExplorer:open', (e) => {
      const filepath = /** @type CustomEvent */ (e).detail;
      const fileIdx = this.fileBook.files.findIndex(file => file.path === filepath);

      fileIdx > -1
        ? this.gotoPage(fileIdx)
        : this.open(filepath);
    });

    // view events
    viewComponent.events.observe('view:notify', (msg, type) => this.notify(msg, type));
    viewComponent.events.observe('view:playing', (playing) => this.setFrameIsPlaying(playing));
    viewComponent.events.observe('view:skip', (forward) => this.flipPage(forward));
    viewComponent.events.observe('view:random', () => this.gotoRandom());
    viewComponent.events.observe('view:mode', () => this.refreshStatus());
    viewComponent.events.observe('view:zoom', () => this.refreshStatus());
    viewComponent.events.observe('view:fullscreen', () => this.toggleFullscreen());
    viewComponent.events.observe('view:loaded', () => {
      this.refreshStatus();
      viewComponent.scrollToEnd(!this.#lastFlipRight); // auto scroll on page display

      // sync selection to viewer if in playlist modde
      if (this.fileExplorer.checkVisibility() && this.fileExplorer.mode === 'playlist')
        this.fileExplorer.syncSelection();
    });
  }

  /**
   * @override
   */
  status() {
    const status = {
      title: '',
      infoLeft: 'None',
      infoRight: '[0/0]'
    };

    const { files, page, currentFile } = this.fileBook;
    if (currentFile != null) {
      const filterInfo = this.#filterQuery.length ? `filter:${this.#filterQuery}` : '';
      const pager = `[${page + 1}/${files.length}]`;
      const { mode, zoom } = this.viewComponent;

      status.title = currentFile.name;
      status.infoLeft = currentFile.name;
      status.infoRight = `${filterInfo} fit-${mode}:${zoom.toFixed(0)}% ${pager}`;
      status.infoLeftFunc = () => {
        navigator.clipboard.writeText(currentFile.path);
        this.notify('filepath copied to clipboard');
      };
    }

    return status;
  }

  /**
   * @override
   * @param {'play'|'pause'|'stop'|'next'|'previous'} action 
   */
  mediaControl(action) {
    const isImg = this.viewComponent.fileType === 'image';

    switch (action) {
      case 'play':
        !isImg && this.viewComponent.media?.playToggle(true);
        break;
      case 'pause': case 'stop':
        isImg
          ? this.viewComponent.slideshow?.toggle(false, false)
          : this.viewComponent.media?.playToggle(false);
        break;
      case 'next': case 'previous':
        !isImg && this.flipPage(action === 'next');
        break;
    }
  }
}
