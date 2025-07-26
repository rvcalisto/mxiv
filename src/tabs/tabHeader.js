// @ts-check
import { Tab } from "./tab.js";
import setDragEvent from "./tabHeaderDrag.js";
import { addItem, removeItem, slideIntoView } from "./tabHeaderPanel.js";


/**
 * Tab HTML header element.
 */
export class TabHeader {

  static #classMap = /** @type {WeakMap<Element, TabHeader>} */ (new WeakMap());
  static #tabsContainer = /** @type {HTMLElement} */ (document.querySelector('#tabs'));

  #nameCount = 1
  /** @type {HTMLElement}          */ #element;
  /** @type {HTMLButtonElement}    */ #playButton;
  /** @type {HTMLParagraphElement} */ #nameLabel;
  /** @type {HTMLButtonElement}    */ #closeButton;


  /**
   * @param {Tab} tabInstance Host Tab instance.
   * @param {string} [name] Tab name. 
   */
  constructor(tabInstance, name = 'tab') {
    this.name;
    this.tabInstance = tabInstance;
    this.#element = this.#createHeaderElement();
    this.rename(name);
  }

  /** 
   * Append current tab HTMLElement to DOM.
   * @returns {HTMLElement}
   */
  #createHeaderElement() {
    const container = document.createElement('div');
    container.className = 'tab';
    TabHeader.#classMap.set(container, this);

    this.#nameLabel = document.createElement('p');

    this.#playButton = document.createElement('button');
    this.#playButton.title = 'playing (click to pause)';
    this.#playButton.setAttribute('icon', 'playing');
    this.#playButton.style.display = 'none';

    // pause media via tab button
    this.#playButton.onclick = (e) => {
      e.stopImmediatePropagation();
      this.tabInstance.frame.mediaControl('pause');
    };

    this.#closeButton = document.createElement('button');
    this.#closeButton.title = 'close tab';
    this.#closeButton.className = 'closeTab';
    this.#closeButton.setAttribute('icon', 'close');
    this.#closeButton.onclick = (e) => {
      e.stopImmediatePropagation();
      this.tabInstance.close();
    };

    // compose & append to DOM
    container.append(this.#playButton, this.#nameLabel, this.#closeButton);
    if (Tab.selected != null)
      addItem(container, Tab.selected.header.#element);
    else
      addItem(container);

    // set tab events
    setDragEvent(container);
    container.onclick = () => this.tabInstance.select();
    container.onauxclick = (e) => {
      if (e.button === 1)
        this.tabInstance.duplicate();
    };

    return container;
  }

  /**
   * Rename header. Add suffix on name repetion. 
   * @param {string} newName 
   */
  rename(newName) {
    if (newName === this.name)
      return;

    let nameIdx = 1, usedSuffixes = [];
    for (const header of TabHeader.allHeaders) {
      if (header.name === newName)
        usedSuffixes.push(header.#nameCount);
    }

    usedSuffixes.sort( (a, b) => a - b );
    for (const idx of usedSuffixes) {
      if (idx === nameIdx)
        nameIdx++;
      else
        break;
    }

    this.name = newName;
    this.#nameCount = nameIdx;

    const textFormat = `${newName} ${nameIdx > 1 ? nameIdx : ''}`;
    this.#nameLabel.textContent = this.#element.title = textFormat;
  }

  /**
   * Remove tab header instance from DOM.
   */
  remove() {
    removeItem(this.#element);
  }

  /**
   * Present header as selected or deselected.
   * @param {boolean} [select=true] True or false.
   */
  select(select = true) {
    if (!select)
      this.#element.classList.remove('selected');
    else {
      this.#element.classList.add('selected');
      slideIntoView(this.#element);
    }
  }

  /**
   * Show or hide play icon from header.
   * @param {boolean} show
   */
  setPlayingIcon(show) {
    this.#playButton.style.display = show ? '' : 'none';
  }

  /**
   * Swap close button icon to signal on-hold tab.
   * @param {boolean} show
   */
  setHoldIcon(show) {
    this.#closeButton.setAttribute('icon', show ? 'hold' : 'close');
  }

  /**
   * Insert header after or before current header.
   * @param {TabHeader} header Header to insert.
   * @param {boolean} [after=true] Either to insert after or before current header.
   */
  insert(header, after = true) {
    if (after)
      this.#element.after(header.#element);
    else
      this.#element.before(header.#element);
  }

  /**
   * Neighbor header on the left, if any.
   * @returns {TabHeader|undefined}
   */
  get left() {
    const neighbor = this.#element.previousElementSibling;
    if (neighbor != null)
      return TabHeader.#classMap.get(neighbor);
  }

  /**
   * Neighbor header on the right, if any.
   * @returns {TabHeader|undefined}
   */
  get right() {
    const neighbor = this.#element.nextElementSibling;
    if (neighbor != null)
      return TabHeader.#classMap.get(neighbor)
  }

  /**
   * All headers at the time, in order of presentation.
   * @returns {TabHeader[]}
   */
  static get allHeaders() {
    const elements = this.#tabsContainer.getElementsByClassName('tab');
    const headers = [...elements].map(element => TabHeader.#classMap.get(element));
    return /** @type TabHeader[] */ (headers);
  }
}
