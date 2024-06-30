/**
 * Generic priority stack.
 * @template T
 */
export class PriorityStack {

  /**
   * @type {T[]}
   */
  #itemArray = [];

  /**
   * Max stack size.
   */
  #stackLimit = 10;

  /**
   * LocalStorage key.
   */
  #storage = '';

  /**
   * @param {String} storageName
   * @param {number} [stackLimit=10]
   */
  constructor(storageName, stackLimit = 10) {
    this.#storage = storageName;
    this.#stackLimit = stackLimit;
    this.reload();
  }

  /** 
   * In order of last inserted.
   * @readonly
   */
  get items() {
    return this.#itemArray;
  }

  /**
   * Load up-to-date items from localStorage.
   */
  reload() {
    const json = localStorage.getItem(this.#storage);
    this.#itemArray = json ? JSON.parse(json) : [];
  }

  /**
   * Write current items to localStorage
   */
  #writeItems() {
    localStorage.setItem( this.#storage, JSON.stringify(this.#itemArray) );
  }

  /**
   * Store item in stack.
   * @param {T} stackItem
   */
  insert(stackItem) {
    // item already in array, switch to top
    if ( this.#itemArray.includes(stackItem) ) {
      const idx = this.#itemArray.indexOf(stackItem);
      this.#itemArray.splice(idx, 1);
      this.#itemArray.unshift(stackItem);
    }
    // add to top, trim array if above limit
    else {
      const newLength = this.#itemArray.unshift(stackItem);
      if (newLength > this.#stackLimit) this.#itemArray.length = this.#stackLimit;
    }

    this.#writeItems();
  }

  /**
   * Remove and returns item from the top of the stack.
   * @returns {T?}
   */
  pop() {
    const stackItem = this.#itemArray.shift() || null;
    if (stackItem != null)
      this.#writeItems();

    return stackItem;
  }

  /**
   * Remove item from stack.
   * @param {T} stackItem
   * @return {Boolean} Success
   */
  remove(stackItem) {
    const itemIdx = this.#itemArray.indexOf(stackItem);
    if (itemIdx < 0)
      return false;

    this.#itemArray.splice(itemIdx, 1);
    this.#writeItems();
    return true;
  }

  /**
   * Clear all items from stack.
   */
  clearAll() {
    this.#itemArray = [];
    this.#writeItems();
  }
};
