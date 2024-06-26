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

  /** 
   * @type {WeakMap<Element, TabHeader>} 
   */
  static #classMap = new WeakMap()

  #nameCount = 1

  #element

  /** @type {HTMLButtonElement} */
  #playButton

  /** @type {HTMLParagraphElement} */
  #nameLabel

  /**
   * Old bar visibility value before fullscreen.
   */
  static #barWasVisible = this.isBarVisible()
  
  // toggle tab bar visibility on fullscreen
  static {
    elecAPI.onFullscreen( function onFullscreenChange(e, isFullscreen) {
      if (isFullscreen) TabHeader.#barWasVisible = TabHeader.isBarVisible()
      TabHeader.toggleHeaderBar(isFullscreen ? false : TabHeader.#barWasVisible)
    })
  }

  /**
   * @param {Tab} tabInstance Host Tab instance.
   * @param {String} name Tab name. 
   */
  constructor(tabInstance, name = 'tab') {
    this.name
    this.tabInstance = tabInstance
    this.#element = this.#createHeaderElement()
    this.rename(name)
  }

  /** 
   * Append current tab HTMLElement to DOM.
   * @returns {HTMLElement}
   */
  #createHeaderElement() {
    const container = document.createElement('div')
    container.className = 'tab'
    TabHeader.#classMap.set(container, this)
    
    this.#nameLabel = document.createElement('p')

    this.#playButton = document.createElement('button')
    this.#playButton.setAttribute('icon', 'playing')
    this.#playButton.style.display = 'none'

    // pause media via tab button
    this.#playButton.onclick = (e) => {
      e.stopImmediatePropagation()
      this.tabInstance.frame.mediaControl('pause')
    }

    // compose & append container, frame to document
    container.append(this.#playButton, this.#nameLabel)
    if (Tab.selected) Tab.selected.header.#element.after(container)
    else document.getElementById('newTab').before(container)

    // set tab events
    container.onclick = () => this.tabInstance.select()
    container.onauxclick = () => this.tabInstance.duplicate()
    container.oncontextmenu = () => this.tabInstance.close()
    TabHeader.#setDrag(container)

    return container
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
    this.#nameLabel.textContent = this.#element.title = textFormat
  }

  /**
   * Remove tab header instance from DOM.
   */
  remove() {
    this.#element.remove()
  }

  /**
   * Present header as selected or deselected.
   * @param {boolean} [select=true] True or false.
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
    this.#playButton.style.display = show ? '' : 'none'
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
    return TabHeader.#classMap.get(this.#element.previousElementSibling)
  }

  /**
   * Neighbor header on the right, if any.
   * @returns {TabHeader?}
   */
  get right() {
    return TabHeader.#classMap.get(this.#element.nextElementSibling)
  }

  /**
   * All headers at the time, in order of presentation.
   * @returns {TabHeader[]}
   */
  static get allHeaders() {
    const elements = document.getElementsByClassName('tab')
    return [...elements].map(element => TabHeader.#classMap.get(element))
  }

  /**
   * Get Header Bar visibility.
   */
  static isBarVisible() {
    return document.getElementById('tabs').style.display === ''
  }
  
  /**
   * Toggle Header Bar visibility.
   * @param {Boolean?} show Either to force visibility on or off.
   */
  static toggleHeaderBar(show) {
    if (show == null) show = !this.isBarVisible()
    document.getElementById('tabs').style.display = show ? '' : 'none'
  }
}
