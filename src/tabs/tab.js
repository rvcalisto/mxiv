import { TabHeader } from "./tabHeader.js"
import { StatusBar } from "../components/statusBar.js"
import { GenericFrame } from "../frames/genericFrame.js"
import { FrameRegistry } from "../frames/frameRegistry.js"


/** 
 * Returns reference to currently active frame component.
 * @type {GenericFrame?}
 */
export var FRAME 


/**
 * Tab instace and manager via static methods.
 */
export class Tab {

  /**
   * Currently selected tab reference.
   * @type {Tab?}
   */
  static selected

  /**
   * Create a new Tab instance.
   * @param {string} [type=viewer] Frame type.
   * @param {(instance:GenericFrame)=>void} [callback] Callback, executed before selection.
   * @param {String} [name=tab] Tab name.
   */
  constructor(type = 'viewer', callback, name = 'tab') {
    this.header = new TabHeader(this, name)
    this.frame = this.#createTabFrame(type)

    if (callback) callback(this.frame)
    this.select()
  }

  /** 
   * Append tab frame component to DOM.
   * @param {string} type Frame type.
   * @returns {GenericFrame}
   */
  #createTabFrame(type) {
    const tabFrame = document.createElement(`${type}-component`)
    tabFrame.setAttribute('frametitle', this.header.name)
    tabFrame.style.display = 'none' // starts hidden

    // observe changes in key attributes
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        const attribute = mutation.attributeName

        if (attribute === 'frametitle')
          this.header.rename( this.frame.getAttribute('frametitle') )
        if (attribute === 'playing')
          this.header.setPlayingIcon( this.frame.hasAttribute('playing') )
        if (attribute === 'updatestatus' && FRAME === this.frame)
          StatusBar.updateStatus( this.frame.status() )
      }
    })

    observer.observe(tabFrame, { attributes: true })
    document.getElementById('contents').appendChild(tabFrame)

    return /** @type {GenericFrame} */ (tabFrame)
  }

  /**
   * Present and update tab references as selected.
   */
  select() {
    if (Tab.selected) {
      Tab.selected.frame.style.display = 'none'
      Tab.selected.header.select(false)
    }

    this.frame.style.display = ''
    this.header.select()

    Tab.selected = this
    FRAME = this.frame
    this.frame.focus()

    StatusBar.updateStatus( this.frame.status() )
  }

  /**
   * Move tab header to the right or to the left.
   * @param {Boolean} [right=true] 
   */
  move(right = true) {
    const next = right ? this.header.right : this.header.left
    if (next != null)
      next.insert(this.header, right)
  }

  /**
   * Rename tab header.
   * @param {String} newName 
   */
  rename(newName) {
    this.frame.renameTab(newName)
  }

  /**
   * Duplicate tab and state.
   */
  duplicate() {
    const type = this.frame.type
    const framePolicy = FrameRegistry.getPolicy(type)
    const frameState = framePolicy.allowDuplicate ? this.frame.getState() : null

    if (!frameState) {
      console.log(`${type}: duplicate disallowed or stateless.`);
      return
    }
    
    const newTab = new Tab(type, async (frame) => {
      frame.restoreState(frameState)
    }, this.frame.tabName)

    // move duplicate behind currentTab
    this.header.insert(newTab.header, true)
  }

  /**
   * Close tab. Pass selection (left, right) if currently selected.
   * @param {boolean} [closeWindowOnLast=true] Also close window if on last tab.
   */
  close(closeWindowOnLast = true) {
    if ( this.frame.hasAttribute('hold') ) {
      this.frame.animate([
        { filter: 'brightness(1)' }, { filter: 'brightness(1.5)' }, 
        { filter: 'brightness(1)' }], { duration: 200 })
      return
    }

    const nextHeader = this.header.left || this.header.right
    this.frame.remove()
    this.header.remove()

    if (nextHeader != null && Tab.selected === this) nextHeader.tabInstance.select()
    else if (nextHeader == null && closeWindowOnLast) window.close()
    else if (Tab.selected === this) Tab.selected = FRAME = null
  }

  /**
   * Create new tab of given type.
   * - `viewer`: Start with FileExplorer open.
   * @param {String} [type]
   * @returns {boolean} Success.
   */
  static newTab(type = 'viewer') {
    const framePolicy = FrameRegistry.getPolicy(type)
    if (framePolicy == null)
      return false
    
    if (!framePolicy.allowDuplicate) {
      const instance = this.allTabs.find(tab => tab.frame.type === type)
      if (instance) {
        instance.select()
        return true
      }
    }

    new Tab(type, frame => {
      if (type === 'viewer') 
        /** @type {import("../frames/viewer/viewer.js").Viewer} */ 
        (frame).fileExplorer.togglePanel()
    })

    return true
  }

  /**
   * Cycle currently selected tab.
   * @param {Boolean} [forward=true] 
   */
  static cycleTabs(forward = true) {
    const header = Tab.selected.header
    const nextHeader = forward ? header.right : header.left

    if (nextHeader == null)
      Tab.allTabs.at(forward ? 0 : -1).select()
    else
      nextHeader.tabInstance.select()
  }

  /**
   * Array of all open tabs at the time, in order of presentation.
   * @returns {Tab[]}
   */
  static get allTabs() {
    const tabs = TabHeader.allHeaders
    return tabs.map(header => header.tabInstance)
  }

  /**
   * Toggle tab Header Bar visibility.
   * @param {Boolean} [show] Either to force visibility on or off.
   */
  static toggleHeaderBar(show) {
    TabHeader.toggleHeaderBar(show)
  }
}


// add newTab event listener (side effect)
document.getElementById('newTab').onclick = function newTabListener() {
  Tab.newTab()
}