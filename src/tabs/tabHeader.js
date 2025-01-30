import { Tab } from "./tab.js"
import setDragEvent from "./tabHeaderDrag.js"


/**
 * Tab HTML header element.
 */
export class TabHeader {

  /** 
   * @type {WeakMap<Element, TabHeader>} 
   */
  static #classMap = new WeakMap()

  static #headerPanel   = /** @type {HTMLElement} */ (document.querySelector('header'))
  static #tabsContainer = /** @type {HTMLElement} */ (document.querySelector('#tabs'))
  static #newTabButton  = /** @type {HTMLElement} */ (document.querySelector('#newTab'))
  static #scrollHeaderL = /** @type {HTMLElement} */ (document.querySelector('#tabScrollL'))
  static #scrollHeaderR = /** @type {HTMLElement} */ (document.querySelector('#tabScrollR'))

  static #headerPanelHeight = getComputedStyle(this.#headerPanel).height
  static #overflowMode = false

  static #wheelVelocity = 0;
  static #wheelInterval = /** @type {NodeJS.Timeout|undefined} */ (undefined);

  /**
   * Old bar visibility value before fullscreen.
   */
  static #barWasVisible = this.isBarVisible()

  #nameCount = 1

  /** @type {HTMLElement}          */ #element
  /** @type {HTMLButtonElement}    */ #playButton
  /** @type {HTMLParagraphElement} */ #nameLabel
  /** @type {HTMLButtonElement}    */ #closeButton

  static {
    // toggle tab bar visibility on fullscreen
    elecAPI.onFullscreen((_e, /** @type {boolean} */ isFullscreen) => {
      if (isFullscreen)
        this.#barWasVisible = this.isBarVisible();

      this.toggleHeaderBar(isFullscreen ? false : this.#barWasVisible);
    });

    // treat overflow also on resize
    addEventListener( 'resize', () => this.#treatOverflow() );

    // disable scroll buttons when hitting start/end positions
    this.#tabsContainer.onscroll = () => {
      this.#scrollHeaderL.toggleAttribute('disabled', this.#tabsContainer.scrollLeft === 0);

      const scrollPosition = this.#tabsContainer.scrollLeft + this.#tabsContainer.offsetWidth;
      const scrollEnd = this.#tabsContainer.scrollWidth;
      this.#scrollHeaderR.toggleAttribute('disabled', scrollPosition === scrollEnd);
    }

    // smooth scroll tab overflow on wheel
    this.#headerPanel.onwheel = (e) => {
      const speed = Math.max( 5, Math.min(10, Math.abs(this.#wheelVelocity) + 1) );
      this.#wheelVelocity = speed * Math.sign(e.deltaY);

      if (this.#wheelInterval != null)
        return;

      this.#wheelInterval = setInterval(() => {
        this.#tabsContainer.scrollBy(this.#wheelVelocity, 0);

        if ( Math.sign(this.#wheelVelocity) === 1 )
          this.#wheelVelocity = Math.max(0, this.#wheelVelocity - .1);
        else
          this.#wheelVelocity = Math.min(0, this.#wheelVelocity + .1);

        if (this.#wheelVelocity === 0) {
          clearInterval(this.#wheelInterval);
          this.#wheelInterval = undefined;
        }
      }, 10);
    }

    // smooth scroll tab overflow on button press
    this.#scrollHeaderL.onmousedown = () => {
      const interval = setInterval(() => this.#tabsContainer.scrollBy(-5, 0), 10);
      addEventListener('mouseup', () => clearInterval(interval), { once: true });
    }

    this.#scrollHeaderR.onmousedown = () => {
      const interval = setInterval(() => this.#tabsContainer.scrollBy(5, 0), 10);
      addEventListener('mouseup', () => clearInterval(interval), { once: true });
    }
  }

  /**
   * @param {Tab} tabInstance Host Tab instance.
   * @param {String} [name] Tab name. 
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
    this.#playButton.title = 'playing (click to pause)'
    this.#playButton.setAttribute('icon', 'playing')
    this.#playButton.style.display = 'none'

    // pause media via tab button
    this.#playButton.onclick = (e) => {
      e.stopImmediatePropagation()
      this.tabInstance.frame.mediaControl('pause')
    }
    
    this.#closeButton = document.createElement('button')
    this.#closeButton.title = 'close tab'
    this.#closeButton.className = 'closeTab'
    this.#closeButton.setAttribute('icon', 'close')
    this.#closeButton.onclick = (e) => {
      e.stopImmediatePropagation()
      this.tabInstance.close()
    }

    // compose & append container, frame to document
    container.append(this.#playButton, this.#nameLabel, this.#closeButton)
    if (Tab.selected != null)
      Tab.selected.header.#element.after(container)
    else if (TabHeader.#overflowMode)
      TabHeader.#tabsContainer.append(container)
    else
      TabHeader.#newTabButton.before(container)

    TabHeader.#treatOverflow()

    // set tab events
    setDragEvent(container)
    container.onclick = () => this.tabInstance.select()
    container.onauxclick = (e) => {
      if (e.button === 1)
        this.tabInstance.duplicate()
    }
    
    return container
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
    TabHeader.#treatOverflow()
  }

  /**
   * Present header as selected or deselected.
   * @param {boolean} [select=true] True or false.
   */
  select(select = true) {
    if (select) {
      this.#element.classList.add('selected')
      this.#element.scrollIntoView()
    } else
      this.#element.classList.remove('selected')
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
    const elements = this.#tabsContainer.getElementsByClassName('tab')
    return [...elements].map(element => TabHeader.#classMap.get(element))
  }

  /**
   * Get Header Bar visibility.
   */
  static isBarVisible() {
    return this.#headerPanel.style.display === ''
  }
  
  /**
   * Toggle Header Bar visibility.
   * @param {Boolean} [show] Either to force visibility on or off.
   */
  static toggleHeaderBar( show = !this.isBarVisible() ) {
    this.#headerPanel.style.display = ''
    const direction = show ? 'normal' : 'reverse';

    this.#headerPanel.animate([
      { height: '0px' }, { height: this.#headerPanelHeight }
    ], { duration: 80, direction }).onfinish = () => {
      this.#headerPanel.style.display = show ? '' : 'none';
      this.#treatOverflow();
    }
  }

  /**
   * Move `newTab` button out of overflow container as tabs overflow,
   * move in otherwise. Show/hide overflow indicators, Update `overflowMode`.
   */
  static #treatOverflow() {
    const overflowing = this.#tabsContainer.clientWidth < this.#tabsContainer.scrollWidth;

    if (overflowing && !this.#overflowMode)
      this.#scrollHeaderR.after(TabHeader.#newTabButton);
    else if (!overflowing && this.#overflowMode)
      this.#tabsContainer.append(TabHeader.#newTabButton);

    this.#overflowMode = overflowing;
    this.#headerPanel.toggleAttribute('overflow', overflowing);
    this.#tabsContainer.querySelector('.selected')?.scrollIntoView();

    this.#tabsContainer.onscroll(); // update scroll buttons on element insertion
  }
}
