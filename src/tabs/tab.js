import { TabHeader } from "./tabHeader.js"
import * as StatusBar from "./statusBar.js"
import { GenericFrame } from "./genericFrame.js"

// concrete frames
import "../components/viewer/viewer.js"
import "../components/library/library.js"


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
   * Creates a new tab Instance.
   * @param {'viewer'|'library'} type Frame type.
   * @param {(instance:(GenericFrame))} func Callback, frame passed as first argument.
   * @param {String} name Tab name.
   */
  constructor(type = 'viewer', func = null, name = 'tab') {
    this.header = new TabHeader(this, name)
    this.frame = this.#createTabFrame(type)

    if (func) func(this.frame)
    this.select()
  }

  /** 
   * Append tab frame component to DOM.
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

    return tabFrame
  }

  /**
   * Present and update tab references as selected.
   */
  select() {
    // hide all frame instances but this one (which count as focus)
    Tab.allTabs.forEach(tab => tab.frame.style.display = 'none')
    this.frame.style.display = ''

    if (Tab.selected) Tab.selected.header.select(false)
    this.header.select()

    Tab.selected = this
    FRAME = this.frame
    this.frame.focus()

    StatusBar.updateStatus( this.frame.status() )
  }

  /**
   * Move tab header to the right or to the left.
   * @param {Boolean} right 
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
    const frameClass = GenericFrame.getClass(type)
    const frameState = frameClass.allowDuplicate ? this.frame.getState() : null

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
      this.frame.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.5)' }, 
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
   * @param {String} type
   */
  static newTab(type = 'viewer') {
    const frameClass = GenericFrame.getClass(type)
    
    if (!frameClass.allowDuplicate) {
      const instance = this.allTabs.find(tab => tab.frame instanceof frameClass)
      if (instance) return instance.select()
    }

    new Tab(type, frame => {
      if (type === 'viewer') frame.fileExplorer.togglePanel()
    })
  }

  /**
   * Cycle currently selected tab.
   * @param {Boolean} forward 
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
   * @param {Boolean?} show Either to force visibility on or off.
   */
  static toggleHeaderBar(show) {
    TabHeader.toggleHeaderBar(show)
  }
}


// add newTab event listener (side effect)
document.getElementById('newTab').onclick = function newTabListener() {
  Tab.newTab()
}