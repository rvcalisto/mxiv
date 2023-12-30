import { Viewer } from "../components/viewer/viewer.js"
import { Library } from "../components/library/library.js"
import * as StatusBar from "../app/statusBar.js"

/** 
 * Returns reference to currently active frame component.
 * @type {Viewer|Library}
 */
export var FRAME 


/**
 * Tab instace and manager via static methods.
 */
export class Tab {

  /** @type {Tab} */
  static selectedTab

  static #DRAG = {
    'origin' : null,
    'originOnLeft' : false, // use after() or before()
    'destination' : null,
  }

  /**
   * Creates a new tab Instance.
   * @param {'viewer'|'library'} type Frame type.
   * @param {(instance:(Viewer|Library))} func Callback, frame passed as first argument.
   * @param {String} name Tab name.
   */
  constructor(type = 'viewer', func = null, name = 'tab') {
    this.name = 'unnamed'
    this.nameCount = 1

    this.btn = this.#createTabBtn()
    this.renameTab(name)

    this.frame = this.#createTabFrame(type)
    if (func) func(this.frame)
    this.select()
  }

  /** 
   * Append current tab HTMLButtonElement to DOM.
   * @returns {HTMLButtonElement}
   */
  #createTabBtn() {
    const tabBtn = document.createElement('div')
    tabBtn.className = 'tab'
    tabBtn.classObj = this // allows class reference by element order on Tab.allTabs
    
    const playState = document.createElement('button')
    tabBtn.playState = playState
    playState.setAttribute('icon', 'playing')
    playState.style.display = 'none'

    // pause media via tab button
    playState.onclick = (e) => {
      e.stopImmediatePropagation()
      if (this.frame.mediaPlayToggle)
        this.frame.mediaPlayToggle(false)
    }

    const label = document.createElement('p')
    tabBtn.label = label
  
    // compose & append tabBtn, frame to document
    tabBtn.append(playState, label)
    if (Tab.selectedTab) Tab.selectedTab.btn.after(tabBtn)
    else document.getElementById('newTab').before(tabBtn)

    // set tab events
    tabBtn.onclick = () => this.select()
    tabBtn.oncontextmenu = () => this.close()
    Tab.#setDrag(tabBtn)

    return tabBtn
  }

  /** 
   * Append tab frame component to DOM.
   * @returns {Viewer|Library}
   */
  #createTabFrame(type) {
    const tabFrame = document.createElement(`${type}-component`)
    tabFrame.tab = this // set reference to self in frame 
    tabFrame.style.display = 'none' // starts hidden

    document.getElementById('contents').appendChild(tabFrame)

    return tabFrame
  }

  /**
   * Close tab and select next in order. Close window if last.
   */
  close() {
    // get next valid neighbor tab
    let next = this.btn.previousElementSibling
    next = next && next.className.includes('tab') ? next : this.btn.nextElementSibling

    this.frame.remove()
    this.btn.remove()

    // close window if last, otherwise pass focus if currently selected
    if (!Tab.allTabs.length) window.close()
    else if (Tab.selectedTab === this) next.classObj.select()
  }

  /**
   * Select tab, update `FRAME` and signals event.
   */
  select() {
    // hide all frame instances but this one
    for (const tab of Tab.allTabs) tab.frame.style.display = 'none'
    this.frame.style.display = '' // making this the only visible tab count as focus

    const tabSelected = document.getElementsByClassName('selected')[0]
    if (tabSelected) tabSelected.classList.remove('selected')
    this.btn.classList.add('selected')

    Tab.selectedTab = this
    FRAME = this.frame
    this.frame.focus()

    StatusBar.updateStatus()
  }

  /**
   * Rename tab. Add suffix on name repetion. 
   * @param {String} newName 
   */
  renameTab(newName) {
    if (newName === this.name) return
    
    let nameIdx = 1, usedSuffixes = []
    for (const tab of Tab.allTabs) {
      if (tab.name === newName) usedSuffixes.push(tab.nameCount);
    }

    usedSuffixes.sort( (a, b) => a - b )
    for (const idx of usedSuffixes) {
      if (idx === nameIdx) nameIdx++
      else break
    }
    
    this.name = newName
    this.nameCount = nameIdx
    
    const textFormat = `${newName} ${nameIdx > 1 ? nameIdx : ''}`
    this.btn.label.textContent = this.btn.title = textFormat
  }

  /** 
   * Set tab play state and play button visibility.
   * @param {Boolean} isPlaying 
   */
  set playing(isPlaying) {
    this.btn.playState.style.display = isPlaying ? '' : 'none'
  }

  /** 
   * Setup mouse drag events for tab button element.
   * @param {HTMLElement} btn Button element to set events.
   */
  static #setDrag(btn) {
    const DRAG = this.#DRAG
    // drag: set tab origin
    btn.onmousedown = (e) => {
      if (e.button === 0) DRAG.origin = btn
    }
    // drag: draw border relative to origin
    btn.onmouseenter = (e) => {
      if (!DRAG.origin || DRAG.origin === btn || !e.buttons) return
      // identify origin position to destination
      const tabBtns = [...document.getElementsByClassName('tab')]
      const originIdx = tabBtns.indexOf(DRAG.origin)
      const targetIdx = tabBtns.indexOf(btn)

      DRAG.originOnLeft = originIdx < targetIdx
      btn.style.borderLeft = DRAG.originOnLeft ? '' : 'solid'
      btn.style.borderRight = DRAG.originOnLeft ? 'solid' : ''
    }
    // drag: clear borders on element exit 
    btn.onmouseleave = () => btn.style.borderLeft = btn.style.borderRight = ''
    // drag: change order
    btn.onmouseup = (e) => {
      if (!DRAG.origin || e.button !== 0 || DRAG.origin === btn) return
      DRAG.originOnLeft ? btn.after(DRAG.origin) : btn.before(DRAG.origin)
      btn.style.borderLeft = btn.style.borderRight = ''
    }
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
   * @param {'viewer'|'library'} type
   */
  static newTab(type = 'viewer') {
    if (type === 'library') {
      const library = this.allTabs.find(tab => tab.frame instanceof Library)
      if (library) return library.select()
    }

    new Tab(type, frame => {
      if (type === 'viewer') frame.fileExplorer.togglePanel()
    })
  }

  /**
   * Duplicate tab and state.
   */
  static duplicateTab() {
    const orgTab = Tab.selectedTab, orgFrame = orgTab.frame
    const frameType = orgFrame.constructor.name.toLowerCase()

    if (!orgFrame.duplicate) {
      console.log(`${frameType} has no 'duplicate' method.`);
      return
    }
    
    const newTab = new Tab(frameType, async (frame) => {
      orgFrame.duplicate(frame)
    }, orgTab.name)

    // move duplicate behind currentTab
    orgTab.btn.after(newTab.btn)
  }

  /**
   * Cycle currently selected tab.
   * @param {Boolean} forward 
   */
  static cycleTabs(forward = true) {
    const selected = Tab.selectedTab.btn
    let next = forward ? selected.nextElementSibling : 
    selected.previousElementSibling
  
    if (!next || !next.classList.contains('tab')) {
      const tabs = document.getElementsByClassName('tab')
      next = tabs[forward ? 0 : tabs.length - 1]
    }
  
    next.click()
  }

  /**
   * Move tab element order.
   * @param {Boolean} right 
   */
  static moveTab(right = true) {
    const selected = Tab.selectedTab.btn
    let next = right ? selected.nextElementSibling : selected.previousElementSibling
    
    if (!next || !next.classList.contains('tab')) return
    right ? selected.before(next) : next.before(selected)
  }

  /**
   * Array of all open tabs at the time, in order of presentation.
   * @returns {Tab[]}
   */
  static get allTabs() {
    const tabs = document.getElementsByClassName('tab')
    return [...tabs].map(element => element.classObj)
  }

  /**
   * Close all tabs. Closes window on end by default.
   * @param {Boolean} keepWindowOpen Either to keep the window open after closing all tabs.
   */
  static closeAll(keepWindowOpen = false) {

    for (const tab of Tab.allTabs) {
      tab.frame.remove()
      tab.btn.remove()
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