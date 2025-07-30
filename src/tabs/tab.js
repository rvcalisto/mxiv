// @ts-check
import { TabHeader } from "./tabHeader.js";
import { statusBar } from "../components/statusBar.js";
import { getFramePolicy, createFrame } from "../frames/frameRegistry.js";
import { NotificationChannel } from "../components/notifier.js";


/**
 * @import { GenericFrame, FrameType } from "../frames/genericFrame.js"
 */

/**
 * @typedef {Tab} TabType
 */

/**
 * @typedef TabProfileType
 * @property {FrameType} type Tab frame type.
 * @property {object} state Tab frame state.
 */

/**
 * @typedef NewTabOptions
 * @property {string} [name] Custom tab name.
 * @property {boolean} [quiet] Suppress policy violation notifications.
 */


/**
 * Currently selected tab reference.
 * @type {Tab?}
 */
export let TAB;

/**
 * Currently selected frame reference.
 * @type {GenericFrame?}
 */
export let FRAME;


/**
 * Tab instance.
 */
class Tab {

  /**
   * Keep tab open against close calls.
   */
  #hold = false;

  /**
   * Create a new Tab instance.
   * @param {FrameType} [type=viewer] Frame type.
   * @param {(instance:GenericFrame)=>void} [callback] Callback, executed before selection.
   * @param {string} [name=tab] Tab name.
   */
  constructor(type = 'viewer', callback, name = 'tab') {
    this.header = new TabHeader(this, name);
    this.frame = this.#setupFrame(type);
    this.channel = new NotificationChannel();

    if (callback)
      callback(this.frame);

    this.select();
  }

  /** 
   * Append tab frame component to DOM.
   * @param {FrameType} type Frame type.
   * @returns {GenericFrame}
   */
  #setupFrame(type) {
    const frame = /** @type {GenericFrame} */ (createFrame(type));

    // set and store tab name, hide frame on start
    frame.tabName = this.header.name;
    frame.style.display = 'none';

    frame.events.observe('frame:notify', (message, typeId) => {
      this.channel.notify(message, typeId);
    });

    frame.events.observe('frame:rename', (newName) => {
      this.header.rename(newName);
    });

    frame.events.observe('frame:hold', (value) => {
      this.header.setHoldIcon(value);
      this.#hold = value;
    });

    frame.events.observe('frame:isPlaying', (isPlaying) => {
      this.header.setPlayingIcon(isPlaying);
    });

    frame.events.observe('frame:statusChange', () => {
      if (frame === FRAME)
        statusBar.updateStatus( frame.status() );
    });

    const contentContainer = /** @type HTMLDivElement */ (document.getElementById('contents'));
    contentContainer.appendChild(frame);

    return frame;
  }

  /**
   * Present and update tab references as selected.
   */
  select() {
    if (TAB) {
      TAB.frame.style.display = 'none';
      TAB.header.select(false);
    }

    this.frame.style.display = '';
    this.header.select();

    TAB = this;
    FRAME = this.frame;
    this.frame.focus();

    statusBar.updateStatus( this.frame.status() );
    this.channel.displayChannel();
    this.frame.onSelected();
  }

  /**
   * Move tab header to the right or to the left.
   * @param {boolean} [right=true] 
   */
  move(right = true) {
    const next = right ? this.header.right : this.header.left;
    if (next != null) {
      next.insert(this.header, right);

      // focus into view in case of overflow
      if (TAB === this)
        this.header.select();
    }
  }

  /**
   * Rename tab header.
   * @param {string} newName 
   */
  rename(newName) {
    this.frame.tabName = newName;
  }

  /**
   * Get profile for tab, if profiling is supported.
   * @returns {TabProfileType?}
   */
  getProfile() {
    const policy = getFramePolicy(this.frame.type);
    if (!policy.allowProfiling)
      return null;

    return {
      type: this.frame.type,
      state: this.frame.getState() || null
    };
  }

  /**
   * Duplicate tab and state.
   */
  duplicate() {
    const tab = newTab(this.frame.type, async (frame) => {
      frame.restoreState( this.frame.getState() );
    }, { name: this.frame.tabName });

    // move duplicate behind currentTab
    if (tab != null)
      this.header.insert(tab.header, true);
  }

  /**
   * Close tab. Pass selection (left, right) if currently selected.
   * @param {boolean} [closeWindowOnLast=true] Also close window if on last tab.
   */
  close(closeWindowOnLast = true) {
    if (this.#hold) {
      this.frame.animate([
        { filter: 'brightness(1)' }, { filter: 'brightness(1.5)' }, 
        { filter: 'brightness(1)' }], { duration: 200 });
      return;
    }

    const nextHeader = this.header.left || this.header.right;
    this.frame.remove();
    this.header.remove();
    this.channel.close();

    if (nextHeader != null && TAB === this)
      nextHeader.tabInstance.select();
    else if (nextHeader == null && closeWindowOnLast)
      window.close();
    else if (TAB === this)
      TAB = FRAME = null;
  }
}


/**
 * Create a new tab of given type, if policy allows it.
 * @param {FrameType} [type=viewer] Frame type.
 * @param {(instance:GenericFrame)=>void} [callback] Callback, executed before selection.
 * @param {NewTabOptions} [options] Custom options.
 * @returns {Tab?}
 */
export function newTab(type = 'viewer', callback, options = {}) {
  const framePolicy = getFramePolicy(type);

  if (!framePolicy.allowDuplicate) {
    const instance = allTabs().find(tab => tab.frame.type === type);
    if (instance) {
      if (!options.quiet) {
        instance.select();
        instance.frame.notify(`${type} doesn't support multiple instances`, 'singleInst');
      }

      return null;
    }
  }

  return new Tab(type, callback, options.name);
}

/**
 * Cycle currently selected tab.
 * @param {boolean} [forward=true] 
 */
export function cycleTabs(forward = true) {
  if (TAB == null)
    return;

  const header = TAB.header;
  const nextHeader = forward ? header.right : header.left;
  
  if (nextHeader == null)
    allTabs().at(forward ? 0 : -1)?.select();
  else
    nextHeader.tabInstance.select();
}

/**
 * Array of all open tabs at the time, in order of presentation.
 * @returns {Tab[]}
 */
export function allTabs() {
  const tabs = TabHeader.allHeaders;
  return tabs.map(header => header.tabInstance);
}

/**
 * Create a Viewer tab with FileExplorer panel visible by default.
 */
export function newFileViewer() {
  newTab('viewer', frame => {
    /** @type {import("../frames/viewer/viewer.js").Viewer} */ 
    (frame).fileExplorer.togglePanel();
  });
}

// add newTab event listener (side effect)
const newTabButton = /** @type HTMLDivElement */ (document.getElementById('newTab'));
newTabButton.onclick = newFileViewer;
