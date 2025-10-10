// @ts-check
import { GenericStorage } from "../genericStorage.js";
import userPreferences from "../userPreferences.js";


/**
 * Recent actions.
 * @type {string[]}
 */
let actionStack = [];

/**
 * Action history limit.
 */
let stackLimit = userPreferences.get('paletteHistorySize');

/**
 * Prompt action history storage.
 * @type {GenericStorage<string[]>}
 */
const actionStorage = new GenericStorage('actionHistory');


/**
 * Reload recent actions from storage.
 */
function reload() {
  const stack = actionStorage.get('stack');

  if (stack != null)
    actionStack = stack;
}


/**
 * Insert action on top of history stack.
 * @param {string} action
 */
function insert(action) {
  // item already in array, switch to top
  if ( actionStack.includes(action) ) {
    const idx = actionStack.indexOf(action);
    actionStack.splice(idx, 1);
    actionStack.unshift(action);
  }
  // add to top, trim array if above limit
  else {
    const newLength = actionStack.unshift(action);
    if (newLength > stackLimit)
      actionStack.length = stackLimit;
  }

  actionStorage.set('stack', actionStack);
}

/**
 * Remove action from stack.
 * @param {string} action
 * @return {boolean} Success
 */
function remove(action) {
  const itemIdx = actionStack.indexOf(action);
  if (itemIdx < 0)
    return false;

  actionStack.splice(itemIdx, 1);
  actionStorage.set('stack', actionStack);
  return true;
}

/**
 * Clear action history stack.
 */
function clearAll() {
  actionStack = [];
  actionStorage.set('stack', actionStack);
}

/**
 * Update history stack limit on user preference changes.
 */
function initialize() {
  userPreferences.events.observe('paletteHistorySize', (/** @type number */ limit) => {
    stackLimit = limit;

    if (actionStack.length > stackLimit)
      actionStack.length = stackLimit;
  });
}


initialize();


/**
 * Recent actions history.
 */
export default {
  get items() { return actionStack },
  reload, insert, remove, clearAll
}
