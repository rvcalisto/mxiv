import { TabHeader } from "./tabHeader.js";
import { statusBar } from "../components/statusBar.js";
import { GenericFrame } from "../frames/genericFrame.js";
import { frameRegistry } from "../frames/frameRegistry.js";


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
   * Create a new Tab instance.
   * @param {string} [type=viewer] Frame type.
   * @param {(instance:GenericFrame)=>void} [callback] Callback, executed before selection.
   * @param {String} [name=tab] Tab name.
   */
  constructor(type = 'viewer', callback, name = 'tab') {
    this.header = new TabHeader(this, name);
    this.frame = this.#createFrame(type);

    if (callback) callback(this.frame);
    this.select();
  }

  /** 
   * Append tab frame component to DOM.
   * @param {string} type Frame type.
   * @returns {GenericFrame}
   */
  #createFrame(type) {
    const tagName = frameRegistry.getTagName(type);
    const frame = /** @type {GenericFrame} */ (document.createElement(tagName));
    frame.tabName = this.header.name;
    frame.style.display = 'none'; // starts hidden

    frame.events.observe('frame:rename', (newName) => {
      this.header.rename(newName);
    })

    frame.events.observe('frame:isPlaying', (isPlaying) => {
      this.header.setPlayingIcon(isPlaying);
    })

    frame.events.observe('frame:statusChange', () => {
      if (frame === FRAME) statusBar.updateStatus( frame.status() );
    })

    document.getElementById('contents').appendChild(frame);

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
    this.frame.onSelected();
  }

  /**
   * Move tab header to the right or to the left.
   * @param {Boolean} [right=true] 
   */
  move(right = true) {
    const next = right ? this.header.right : this.header.left;
    if (next != null) {
      next.insert(this.header, right);

      if (Tab.selected === this)
        this.header.select(); // focus into view in case of overflow
    }
  }

  /**
   * Rename tab header.
   * @param {String} newName 
   */
  rename(newName) {
    this.frame.tabName = newName;
  }

  /**
   * Duplicate tab and state.
   */
  duplicate() {
    const type = this.frame.type;
    const framePolicy = frameRegistry.getPolicy(type);
    const frameState = framePolicy.allowDuplicate ? this.frame.getState() : null;

    if (!frameState) {
      console.log(`${type}: duplicate disallowed or stateless.`);
      return;
    }
    
    const newTab = new Tab(type, async (frame) => {
      frame.restoreState(frameState);
    }, this.frame.tabName);

    // move duplicate behind currentTab
    this.header.insert(newTab.header, true);
  }

  /**
   * Close tab. Pass selection (left, right) if currently selected.
   * @param {boolean} [closeWindowOnLast=true] Also close window if on last tab.
   */
  close(closeWindowOnLast = true) {
    if ( this.frame.hasAttribute('hold') ) {
      this.frame.animate([
        { filter: 'brightness(1)' }, { filter: 'brightness(1.5)' }, 
        { filter: 'brightness(1)' }], { duration: 200 });
      return;
    }

    const nextHeader = this.header.left || this.header.right;
    this.frame.remove();
    this.header.remove();

    if (nextHeader != null && Tab.selected === this) nextHeader.tabInstance.select();
    else if (nextHeader == null && closeWindowOnLast) window.close();
    else if (Tab.selected === this) Tab.selected = FRAME = null;
  }

  /**
   * Create new tab of given type.
   * - `viewer`: Start with FileExplorer open.
   * @param {String} [type]
   * @returns {boolean} Success.
   */
  static newTab(type = 'viewer') {
    const framePolicy = frameRegistry.getPolicy(type);
    if (framePolicy == null) return false;
    
    if (!framePolicy.allowDuplicate) {
      const instance = this.allTabs.find(tab => tab.frame.type === type);
      if (instance) {
        instance.select();
        return true;
      }
    }

    new Tab(type, frame => {
      if (type === 'viewer') 
        /** @type {import("../frames/viewer/viewer.js").Viewer} */ 
        (frame).fileExplorer.togglePanel();
    });

    return true;
  }

  /**
   * Cycle currently selected tab.
   * @param {Boolean} [forward=true] 
   */
  static cycleTabs(forward = true) {
    const header = Tab.selected.header;
    const nextHeader = forward ? header.right : header.left;

    if (nextHeader == null)
      Tab.allTabs.at(forward ? 0 : -1).select();
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


// add newTab event listener (side effect)
document.getElementById('newTab').onclick = function newTabListener() {
  Tab.newTab();
}
