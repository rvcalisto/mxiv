import { Tab } from "./tab.js"


/**
 * Tab HTML header element.
 */
export class TabHeader {

  static #DRAG = {
    'origin' : null,
    'originOnLeft' : false, // use after() or before()
    'destination' : null,
  }

  #nameCount = 1

  #element

  /**
   * @param {Tab} tabInstance Host Tab instance.
   * @param {String} name Tab name. 
   */
  constructor(tabInstance, name = 'tab') {
    this.name
    this.tabInstance = tabInstance
    this.#element = this.#createTabBtn()
    this.rename(name)
  }

  /** 
   * Append current tab HTMLButtonElement to DOM.
   * @returns {HTMLButtonElement}
   */
  #createTabBtn() {
    const tabBtn = document.createElement('div')
    tabBtn.className = 'tab'
    tabBtn.classObj = this // instance reference by element
    
    const playBtn = document.createElement('button')
    tabBtn.playBtn = playBtn
    playBtn.setAttribute('icon', 'playing')
    playBtn.style.display = 'none'

    // pause media via tab button
    playBtn.onclick = (e) => {
      e.stopImmediatePropagation()
      this.tabInstance.frame.mediaControl('pause')
    }

    const label = document.createElement('p')
    tabBtn.label = label
  
    // compose & append tabBtn, frame to document
    tabBtn.append(playBtn, label)
    if (Tab.selected) Tab.selected.header.#element.after(tabBtn)
    else document.getElementById('newTab').before(tabBtn)

    // set tab events
    tabBtn.onclick = () => this.tabInstance.select()
    tabBtn.onauxclick = () => this.tabInstance.duplicate()
    tabBtn.oncontextmenu = () => this.tabInstance.close()
    TabHeader.#setDrag(tabBtn)

    return tabBtn
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
   * Rename header. Add suffix on name repetion. 
   * @param {String} newName 
   */
  rename(newName) {
    if (newName === this.name) return
    
    let nameIdx = 1, usedSuffixes = []
    for (const header of TabHeader.allHeaders) {
      if (header.name === newName) usedSuffixes.push(header.#nameCount);
    }

    usedSuffixes.sort( (a, b) => a - b )
    for (const idx of usedSuffixes) {
      if (idx === nameIdx) nameIdx++
      else break
    }
    
    this.name = newName
    this.#nameCount = nameIdx
    
    const textFormat = `${newName} ${nameIdx > 1 ? nameIdx : ''}`
    this.#element.label.textContent = this.#element.title = textFormat
  }

  /**
   * Remove tab header instance from DOM.
   */
  remove() {
    this.#element.remove()
  }

  /**
   * Present header as selected or deselected.
   * @param {true} select True or false.
   */
  select(select = true) {
    if (select) this.#element.classList.add('selected')
    else this.#element.classList.remove('selected')
  }

  /**
   * Show or header hide playing icon.
   * @param {boolean} show
   */
  setPlayingIcon(show) {
    this.#element.playBtn.style.display = show ? '' : 'none'
  }

  /**
   * Insert header after or before current header.
   * @param {TabHeader} header Header to insert.
   * @param {Boolean} [after=true] Either to insert after or before current header.
   */
  insert(header, after = true) {
    if (after) this.#element.after(header.#element)
    else this.#element.before(header.#element)
  }

  /**
   * Neighbor header on the left, if any.
   * @returns {TabHeader?}
   */
  get left() {
    return this.#element.previousElementSibling?.classObj
  }

  /**
   * Neighbor header on the right, if any.
   * @returns {TabHeader?}
   */
  get right() {
    return this.#element.nextElementSibling?.classObj
  }

  /**
   * All headers at the time, in order of presentation.
   * @returns {TabHeader[]}
   */
  static get allHeaders() {
    const elements = document.getElementsByClassName('tab')
    return [...elements].map(element => element.classObj)
  }

  /**
   * Get Header Bar visibility.
   */
  static get headerBarVisible() {
    return document.getElementById('tabs').style.display === ''
  }
  
  /**
   * Toggle Header Bar visibility.
   * @param {Boolean?} show Either to force visibility on or off.
   */
  static toggleHeaderBar(show) {
    if (show == null) show = !this.headerBarVisible
    document.getElementById('tabs').style.display = show ? '' : 'none'
  }
}


// toggle tab bar visibility on fullscreen
let headerBarWasVisible = TabHeader.headerBarVisible
elecAPI.onFullscreen( function onFullscreenChange(e, isFullscreen) {
  if (isFullscreen) headerBarWasVisible = TabHeader.headerBarVisible
  TabHeader.toggleHeaderBar(isFullscreen ? false : headerBarWasVisible)
})