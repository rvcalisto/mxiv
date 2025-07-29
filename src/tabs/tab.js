// @ts-check
import { TabHeader } from "./tabHeader.js";
import { statusBar } from "../components/statusBar.js";
import { GenericFrame } from "../frames/genericFrame.js";
import { getFramePolicy, createFrame } from "../frames/frameRegistry.js";
import { NotificationChannel } from "../components/notifier.js";


/**
 * @typedef {import("../frames/frameRegistry.js").FrameType} FrameType
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
 * Returns reference to currently active frame component.
 * @type {GenericFrame?}
 */
export let FRAME;


/**
 * Tab instace and manager via static methods.
 */
export class Tab {

  /**
   * Currently selected tab reference.
   * @type {Tab?}
   */
  static selected;

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
    if (Tab.selected) {
      Tab.selected.frame.style.display = 'none';
      Tab.selected.header.select(false);
    }

    this.frame.style.display = '';
    this.header.select();

    Tab.selected = this;
    FRAME = this.frame;
    this.frame.focus();

    statusBar.updateStatus( this.frame.status() );
    this.channel.diplayChannel();
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
      if (Tab.selected === this)
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
    const newTab = Tab.newTab(this.frame.type, async (frame) => {
      frame.restoreState( this.frame.getState() );
    }, { name: this.frame.tabName });

    // move duplicate behind currentTab
    if (newTab != null)
      this.header.insert(newTab.header, true);
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

    if (nextHeader != null && Tab.selected === this)
      nextHeader.tabInstance.select();
    else if (nextHeader == null && closeWindowOnLast)
      window.close();
    else if (Tab.selected === this)
      Tab.selected = FRAME = null;
  }

  /**
   * Create a new tab of given type, if policy allows it.
   * @param {FrameType} [type=viewer] Frame type.
   * @param {(instance:GenericFrame)=>void} [callback] Callback, executed before selection.
   * @param {NewTabOptions} [options] Custom options.
   * @returns {Tab?}
   */
  static newTab(type = 'viewer', callback, options = {}) {
    const framePolicy = getFramePolicy(type);

    if (!framePolicy.allowDuplicate) {
      const instance = this.allTabs.find(tab => tab.frame.type === type);
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
  static cycleTabs(forward = true) {
    if (Tab.selected == null)
      return;

    const header = Tab.selected.header;
    const nextHeader = forward ? header.right : header.left;

    if (nextHeader == null)
      Tab.allTabs.at(forward ? 0 : -1)?.select();
    else
      nextHeader.tabInstance.select();
  }

  /**
   * Array of all open tabs at the time, in order of presentation.
   * @returns {Tab[]}
   */
  static get allTabs() {
    const tabs = TabHeader.allHeaders;
    return tabs.map(header => header.tabInstance);
  }
}


/**
 * Create a Viewer tab with FileExplorer panel visible by default.
 */
export function newFileViewer() {
  Tab.newTab('viewer', frame => {
    /** @type {import("../frames/viewer/viewer.js").Viewer} */ 
    (frame).fileExplorer.togglePanel();
  });
}

// add newTab event listener (side effect)
const newTabButton = /** @type HTMLDivElement */ (document.getElementById('newTab'));
newTabButton.onclick = newFileViewer;
