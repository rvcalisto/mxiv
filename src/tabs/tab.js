import { TabHeader } from "./tabHeader.js"
import * as StatusBar from "./statusBar.js"
import { GenericFrame } from "./genericFrame.js"

// concrete frames
import "../components/viewer/viewer.js"
import "../components/library/library.js"


/** 
 * Returns reference to currently active frame component.
 * @type {GenericFrame}
 */
export var FRAME 


/**
 * Tab instace and manager via static methods.
 */
export class Tab {

  /** @type {Tab} */
  static selectedTab

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
          this.header.setPlayingIcon( this.frame.getAttribute('playing') === 'true' )
        if (attribute === 'updatestatus' && FRAME === this.frame)
          StatusBar.updateStatus( this.frame.status() )
      }
    })

    observer.observe(tabFrame, { attributes: true })
    document.getElementById('contents').appendChild(tabFrame)

    return tabFrame
  }

  /**
   * Closes tab. Quit window if last remaining instance.
   * - If currently selected, pass selection to the left or right instance.
   */
  close() {
    const allTabs = Tab.allTabs
    const thisIdx = allTabs.findIndex(tab => tab === this)
    const next = allTabs[thisIdx -1] || allTabs[thisIdx +1]

    this.frame.remove()
    this.header.remove()

    if (!Tab.allTabs.length) window.close()
    else if (Tab.selectedTab === this) next.select()
  }

  /**
   * Present and update tab references as selected.
   */
  select() {
    // hide all frame instances but this one (which count as focus)
    Tab.allTabs.forEach(tab => tab.frame.style.display = 'none')
    this.frame.style.display = ''

    if (Tab.selectedTab) Tab.selectedTab.header.select(false)
    this.header.select()

    Tab.selectedTab = this
    FRAME = this.frame
    this.frame.focus()

    StatusBar.updateStatus( this.frame.status() )
  }

  /**
   * Rename tab header.
   * @param {String} newName 
   */
  renameTab(newName) {
    this.frame.renameTab(newName)
  }
  
  /**
   * Toggle tab bar visibility.
   * @param {Boolean?} show Either to force visibility on or off.
   */
  static toggleTabBar(show) {
    const tabsBar = document.getElementById('tabs')
    
    if (show === undefined) show = tabsBar.style.display == 'none'
    tabsBar.style.display = show ? '' : 'none'
  }

  /**
   * Get tab bar visibility.
   */
  static get tabBarIsVisible() {
    const tabsBar = document.getElementById('tabs')
    return tabsBar.style.display == ''
  }

  /**
   * Create default new tab.
   * - `viewer`: Start with FileExplorer open.
   * - `library`: Enforce single instance, focus tab.
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
   * Duplicate tab and state.
   */
  static duplicateTab() {
    const tab = Tab.selectedTab
    const type = tab.frame.type

    const frameClass = GenericFrame.getClass(type)
    const frameState = frameClass.allowDuplicate ? tab.frame.getState() : null

    if (!frameState) {
      console.log(`${type}: duplicate disallowed or stateless.`);
      return
    }
    
    const newTab = new Tab(type, async (frame) => {
      frame.restoreState(frameState)
    }, tab.name)

    // move duplicate behind currentTab
    tab.header.after(newTab.header)
  }

  /**
   * Cycle currently selected tab.
   * @param {Boolean} forward 
   */
  static cycleTabs(forward = true) {
    const selected = Tab.selectedTab

    const allTabs = Tab.allTabs
    const thisIdx = allTabs.findIndex(tab => tab === selected)

    let nextIdx = forward ? (thisIdx +1) : (thisIdx -1)
    if (nextIdx < 0) nextIdx = allTabs.length -1 // wrap around negatives

    const nextTab = allTabs[nextIdx % allTabs.length]
    nextTab.select()
  }

  /**
   * Move selected tab header order.
   * @param {Boolean} right 
   */
  static moveTab(right = true) {
    Tab.selectedTab.header.move(right)
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
   * Close all tabs. Closes window on end by default.
   * @param {Boolean} keepWindowOpen Either to keep the window open after closing all tabs.
   */
  static closeAll(keepWindowOpen = false) {
    for (const tab of Tab.allTabs) {
      tab.frame.remove()
      tab.header.remove()
    }
    
    // update Tab class properties 
    Tab.selectedTab = null
    FRAME = null

    if (!keepWindowOpen) window.close()
  }
}


// add newTab event listener (side effect)
document.getElementById('newTab').onclick = function newTabListener() {
  Tab.newTab()
}


// toggle tab bar visibility on fullscreen
let oldTabBarVisibility = Tab.tabBarIsVisible
elecAPI.onFullscreen( function onFullscreenChange(e, isFullscreen) {
  if (isFullscreen) oldTabBarVisibility = Tab.tabBarIsVisible
  Tab.toggleTabBar(isFullscreen ? false : oldTabBarVisibility)
})