// @ts-check
import { ItemList } from "../itemList.js";
import { InputPrompt } from "./inputPrompt.js";
import actionHistory from "./actionHistory.js";
import { OptionElement } from "./optionElement.js";
import { getCurrentActions } from "../../actions/actionService.js";
import { getCurrentAccelerators } from "../../actions/acceleratorService.js";
import { notify } from "../notifier.js";


/**
 * @typedef {'history'|'group'|'action'|'argument'|'shortcut'} OptionType
 */

/**
 * Descriptive option object for display in ActionPalette.
 * @typedef OptionObject
 * @property {string} name Option name.
 * @property {string} desc Option description.
 * @property {OptionType} type Option type.
 * @property {string[]} [keys] Filter key overrides.
 */


/**
 * Action Palette container element.
 */
const containerElement = /** @type {HTMLDivElement} */ (document.querySelector('action-palette'));

/**
 * Hint element list.
 */
const listElement = /** @type ItemList */ (containerElement.querySelector('item-list'));

/**
 * Info paragraph element.
 */
const infoElement = /** @type HTMLParagraphElement */ (containerElement.querySelector('.paletteInfo'));

/**
 * Action Palette text prompt element.
 */
const inputElement = new InputPrompt( /** @type HTMLInputElement */ (containerElement.querySelector('input')) );


/**
 * Action palette visibility.
 * @returns {boolean}
 */
export let paletteIsVisible = false;

/**
 * Returns rich option object to be displayed by ActionPalette.
 * @param {string} name Option name.
 * @param {string} [desc] Option description.
 * @param {OptionType} [type='generic'] Option type.
 * @param {string[]} [keys] Option keys.
 * @returns {OptionObject}
 */
export const option = (name, desc = '', type = 'argument', keys) => ({
  name: name,
  desc: desc,
  type: type,
  keys
});


/**
 * Returns a HTMLElement for this option.
 * @param {OptionObject|string} item Option string or object.
 * @param {string[]} [leadingAction] Action being evaluated.
 * @returns {OptionElement}
 */
function createElement(item, leadingAction = []) {
  let name = '', desc = '', type = /** @type OptionType */ ('argument');
  typeof item !== 'string'
    ? (name = item.name, desc = item.desc, type = item.type)
    : (name = item);

  const element = OptionElement.createElement(type, name, desc);
  const frameAccelerators = getCurrentAccelerators();

  // tag accelerators keys, if any
  element.tags = type === 'shortcut'
    ? frameAccelerators.byAction( name.split(' ') )
    : frameAccelerators.byAction([...leadingAction, name]);

  if (type === 'history') {
    element.onForget = () => {
      clearActionHistory(name);
      togglePalette(true); // recapture focus after click
    }
  }

  element.onclick = () => {
    listElement.selectIntoFocus(element, { block: 'nearest' });
    inputElement.focus();
  };

  element.onAccess = () => {
    inputElement.setText(name);
  };

  element.ondblclick = () => {
    element.onAccess();
    displayHints();
  };

  return element;
}

/**
 * Generate hint list based on current inputElement text.
 */
async function displayHints() {
  setPaletteInfo('');

  const currentActions = getCurrentActions(),
        inputTextArray = inputElement.getTextArrayBeforeCursor(),
        [cmd = '', ...args] = inputTextArray;

  const actionMap = currentActions.getActions(),
        groupMap = currentActions.getGroups(),
        group = groupMap.get(cmd);

  // hint history, groups, actions
  if (args.length < 1) {
    const history = actionHistory.items
      .map( key => option(key, '', 'history') );

    const groups = [...groupMap]
      .map( ([key, group]) => option(key, group.desc, 'group') );

    const actions = [];
    actionMap.forEach( (action, key) => {
      const words = action.desc.split(' ');

      if ( key.includes(' ') ) // match group actions by name upon 2 characters
        cmd.length > 1 && actions.push( option(key, action.desc, 'shortcut', [key.split(' ')[1], ...words]) );
      else // match non-group actions
        actions.push( option(key, action.desc, 'action', [key, ...words]) );
    });

    return listElement.populate( history.concat(groups, actions), 
      item => createElement(item, []), 
      standardFilter(cmd)
    );
  }

  let options = [],
      lastArg = /** @type {string} */ (args.at(-1)) || '';

  const action = actionMap.has(`${cmd} ${args[0]}`)
    ? actionMap.get(`${cmd} ${args.shift()}`)
    : actionMap.get(cmd);

  // hint group actions
  if (group != null && inputTextArray.length < 3)
    options = Object.entries(group.actions)
      .map( ([name, action]) => option(name, action.desc, 'action') );

  // hint action options
  else if (action != null && action.options != null && args.length > 0)
    options = await action.options(lastArg, args);

  const leadingAction = inputTextArray
    .slice(0, inputTextArray.length > 1 ? -1 : undefined);

  return listElement.populate(options, 
    item => createElement(item, leadingAction), 
    action != null && action.customFilter
      ? action.customFilter(lastArg)
      : standardFilter(lastArg)
  );
}

/**
 * Set argument information paragraph.
 * @param {string} message Message to display.
 */
export function setPaletteInfo(message) {
  infoElement.textContent = message;

  /** @type {HTMLDivElement} */ (infoElement.parentElement)
    .style.display = message === '' ? 'none' : '';
}

/**
 * Initialize input event handlers.
 */
function initialize() {
  // close action palette if clicking outside content
  containerElement.onclick = (e) => togglePalette(e.target !== containerElement);

  // display hints on value input
  inputElement.onselectionchange = () => displayHints();

  // control inputs
  inputElement.onkeydown = (e) => {

    // navigate hints
    if (e.key === 'Tab' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = e.key === 'ArrowDown' || e.key === 'Tab' && !e.shiftKey;
      const element = listElement.navItems(next);
      if (element)
        element.scrollIntoView(false);
    }

    // close when prompt is fully erased
    else if (e.key === 'Backspace' && inputElement.getText().length < 1) {
      e.stopImmediatePropagation();
      togglePalette(false);
    }

    // delete history-type hint
    else if (e.key === 'Delete') {
      const selection = listElement.getSelectedElement();
      if (selection && selection.onForget != null) {
        e.preventDefault();

        const element = listElement.navItems();
        if (element)
          element.scrollIntoView(false);

        selection.onForget();
        selection.remove();
      }
    }

    // complete, confirm
    else if (e.key === 'Enter' || e.key === ' ' && e.shiftKey) {
      e.preventDefault();
      e.stopImmediatePropagation();

      const selection = listElement.getSelectedElement();
      if (selection) {
        selection.onAccess();
        displayHints();
      } else {
        togglePalette(false);
        runAction( inputElement.getText() );
      }
    }

    // select word at cursor position
    else if ( e.key.toLocaleLowerCase() === 'd' && e.ctrlKey ) {
      e.preventDefault();
      inputElement.expandSelection();
    }
  };
}


/**
 * Run action in current context.
 * @param {string} actionText Action string.
 */
function runAction(actionText) {
  const action = InputPrompt.unescapeIntoArray(actionText);

  if (action.length < 1)
    return;

  const frameActions = getCurrentActions();
  if ( frameActions.run(action) ) {
    const textItem = actionText.trim();

    if (textItem !== 'palette repeatLast')
      actionHistory.insert(textItem);

    return;
  }

  frameActions.getGroups().has(action[0])
    ? notify(`"${action[1]}" isn't a "${action[0]}" action in current context`, 'runAct')
    : notify(`"${action[0]}" isn't an action nor group in current context`, 'runAct');
}

/**
 * Returns an ItemList filter function for standard options context.
 * @param {string} query ItemList filter query.
 * @returns {(item:string|OptionObject)=>boolean} Filter function.
 */
export function standardFilter(query) {
  return (item) => {
    let keys;
    if (typeof item !== 'string') {
      keys = item.keys;
      item = item.name;
    }

    const itemIsDot = item[0] === '.',
          queryIsDot = query[0] === '.';

    // empty query, show all non-dot-files
    if ( !query.trim() )
      return !itemIsDot;

    // only show matches if for same item-query category
    const lowerCaseQuery = query.toLowerCase();
    const match = keys == null || keys.length < 1
      ? item.toLowerCase().includes(lowerCaseQuery)
      : keys.some( str => str.toLowerCase().includes(lowerCaseQuery) );

    return itemIsDot 
      ? match && queryIsDot 
      : match;
  }
}

/**
 * Toggle palette visibility. Focus prompt if opening while open.
 * @param {boolean} open Open or close palette.
 * @param {string} [text] Optional prompt text.
 */
export function togglePalette(open, text = '') {
  containerElement.style.display = ''; // make visible and focusable

  if (open) {
    inputElement.focus();
    // already visible, stop at focus
    if (paletteIsVisible)
      return;

    // sync potential changes from other windows
    actionHistory.reload();

    inputElement.setText(text, true);
    displayHints();
  }

  // play fade-in/out animation, clear list on close
  paletteIsVisible = open;
  containerElement.animate(
    [{ opacity : open ? 0 : 1 }, { opacity : open ? 1 : 0 }],
    { duration: 150}
  ).onfinish = () => {
    if (!open) {
      listElement.populate([], createElement);
      containerElement.style.display = 'none';
    }
  };
}

/**
 * Repeat last executed action, if any.
 */
export function repeatLastAction() {
  actionHistory.items.length > 0
    ? runAction(actionHistory.items[0])
    : notify('no recent actions to repeat', 'repeatLast');
}

/**
 * Clear recently executed action history.
 * @param {string} [historyItem] If given, remove only matching item.
 */
export function clearActionHistory(historyItem) {
  if (historyItem == null) {
    actionHistory.clearAll();
    notify('history cleared', 'clearHistory');
  } else {
    actionHistory.remove(historyItem)
      ? notify('history item removed', 'clearAction')
      : notify('failed to remove history item', 'clearAction');
  }
}


initialize();


/**
 * Action palette methods.
 */
export default {
  get paletteIsVisible() { return paletteIsVisible },
  togglePalette, repeatLastAction, clearActionHistory, setPaletteInfo
};
