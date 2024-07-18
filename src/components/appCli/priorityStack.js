import { ObservableEvents } from "../observableEvents.js";


/**
 * @typedef {'stackChange'} StackEvents
 */


/**
 * Generic priority stack.
 * @template T
 */
export class PriorityStack {

  /**
   * Stack items.
   * @type {T[]}
   */
  items;

  /**
   * Max stack size.
   */
  #stackLimit = 10;

  /**
   * Stack events.
   * @type {ObservableEvents<StackEvents>}
   */
  events = new ObservableEvents();

  /**
   * @param {T[]} [stackItems=[]] Initialize stack from array.
   * @param {number} [stackLimit=10] Stack limit, 10 by default.
   */
  constructor(stackItems = [], stackLimit = 10) {
    this.items = stackItems;
    this.#stackLimit = stackLimit;
  }

  /**
   * Store item in stack.
   * @param {T} stackItem
   */
  insert(stackItem) {
    // item already in array, switch to top
    if ( this.items.includes(stackItem) ) {
      const idx = this.items.indexOf(stackItem);
      this.items.splice(idx, 1);
      this.items.unshift(stackItem);
    }
    // add to top, trim array if above limit
    else {
      const newLength = this.items.unshift(stackItem);
      if (newLength > this.#stackLimit) this.items.length = this.#stackLimit;
    }

    this.events.fire('stackChange');
  }

  /**
   * Remove and returns item from the top of the stack.
   * @returns {T?}
   */
  pop() {
    const stackItem = this.items.shift() || null;
    if (stackItem != null)
      this.events.fire('stackChange');

    return stackItem;
  }

  /**
   * Remove item from stack.
   * @param {T} stackItem
   * @return {Boolean} Success
   */
  remove(stackItem) {
    const itemIdx = this.items.indexOf(stackItem);
    if (itemIdx < 0)
      return false;

    this.items.splice(itemIdx, 1);
    this.events.fire('stackChange');
    return true;
  }

  /**
   * Clear all items from stack.
   */
  clearAll() {
    this.items = [];
    this.events.fire('stackChange');
  }
};
