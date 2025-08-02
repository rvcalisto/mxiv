// @ts-check
import { ItemList } from "../itemList.js";
import { InputPrompt } from "./inputPrompt.js";
import { PriorityStack } from "./priorityStack.js";
import { OptionElement } from "./optionElement.js";
import { getCurrentActions } from "../../actions/actionService.js";
import { getCurrentAccelerators } from "../../actions/acceleratorService.js";
import { notify } from "../notifier.js";
import { GenericStorage } from "../genericStorage.js";


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
 * Display hints, methods and execute actions for current component.
 */
class ActionPalette extends HTMLElement {

  static tagName = 'action-palette';

  /**
   * Hint element list.
   * @type {ItemList<?, OptionElement>}
   */
  #list;

  /**
   * Prompt element.
   * @type {InputPrompt}
   */
  #prompt;

  /**
   * Prompt action history stack.
   * @type {PriorityStack<string>}
   */
  #actionStack = new PriorityStack();

  /**
   * Prompt action history storage.
   * @type {GenericStorage<string[]>}
   */
  #store = new GenericStorage('actionHistory');

  /**
   * Background overlay.
   * @type {HTMLDivElement}
   */
  #background;

  /**
   * Visibility state.
   */
  active = false;

  connectedCallback() {
    const template = /** @type HTMLTemplateElement */ (document.getElementById('actionPaletteTemplate'));
    const shadowRoot = this.attachShadow({ mode: 'open' });
    shadowRoot.append( template.content.cloneNode(true) );

    this.#list = /** @type ItemList */ (shadowRoot.getElementById('itemList'));
    this.#prompt = new InputPrompt( /** @type HTMLInputElement */ (shadowRoot.getElementById('cmdInput')) );
    this.#background = /** @type HTMLDivElement */ (shadowRoot.getElementById('cmdOverlay'));

    this.#initEvents();
  }

  /**
   * Toggle visibility. Focus prompt if opening while already open.
   * @param {boolean} open Open or close action palette.
   * @param {string} [optionalStr] Open on custom string.
   */
  toggle(open, optionalStr = '') {
    // make elements visible and focusable
    this.#background.style.display = '';

    // focus prompt, sync action history between windows, set text & list hints.
    if (open) {
      this.#prompt.focus();
      if (this.active)
        return;

      const historyStack = this.#store.get('stack');
      if (historyStack)
        this.#actionStack.items = historyStack;
      
      this.#prompt.setText(optionalStr);
      this.#displayHints();
    } 

    // set state, play fade-in/out animation and clear list on close
    this.active = open;
    this.#background.animate(
      [{ opacity : open ? 0 : 1 }, { opacity : open ? 1 : 0 }],
       { duration: 150}
    ).onfinish = () => {
      if (!open) {
        this.#list.populate([], this.#createElement);
        this.#background.style.display = 'none';
      }
    };
  }

  /**
   * Run given action text, otherwise get it from input.
   * @param {string} [actionText] Optional action text.
   */
  #runAction(actionText) {
    actionText = actionText || this.#prompt.getText();
    const action = InputPrompt.unescapeIntoArray(actionText);

    if (action.length < 1)
      return; 

    const frameActions = getCurrentActions();
    if ( frameActions.run(action) ) {
      const textItem = actionText.trim();

      if (textItem !== 'palette repeatLast')
        this.#actionStack.insert(textItem);

      return;
    }

    frameActions.getGroups().has(action[0])
      ? notify(`"${action[1]}" isn't a "${action[0]}" action in current context`, 'runAct')
      : notify(`"${action[0]}" isn't an action nor group in current context`, 'runAct');
  }

  /**
   * Erase past executed action or actions from history.
   * @param {string} [historyItem] If given, remove only this item from history.
   */
  clearActionHistory(historyItem) {
    if (historyItem == null) {
      this.#actionStack.clearAll();
      notify('history cleared', 'actionPalette:clear');
    } else {
      this.#actionStack.remove(historyItem);
      notify('history item removed', 'actionPalette:forget');
      this.toggle(true); // recapture focus from 'forget' button click
    }
  }

  /**
   * Repeat last executed action.
   */
  repeatAction() {
    if (this.#actionStack.items.length > 0)
      this.#runAction(this.#actionStack.items[0]);
  }

  /**
   * Returns a HTMLElement for this option.
   * @param {OptionObject|string} item Option string or object.
   * @param {string[]} [leadingAction] Action being evaluated.
   * @param {boolean} [replace=false] Either option replaces input prompt.
   * @returns {OptionElement}
   */
  #createElement(item, leadingAction = [], replace = false) {
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
      element.onForget = () => this.clearActionHistory(name);
    }

    element.onclick = () => {
      this.#list.selectIntoFocus(element, { block: 'nearest' });
      this.#prompt.focus();
    };

    element.onAccess = () => {
      this.#prompt.setText(name, replace);
    };

    element.ondblclick = () => {
      element.onAccess();
      this.#displayHints();
    };

    return element;
  }

  /**
   * Generate hint list based on current this.#prompt text.
   */
  async #displayHints() {
    const currentActions = getCurrentActions(),
          inputTextArray = this.#prompt.getTextArray(),
          [cmd = '', ...args] = inputTextArray;

    const actionMap = currentActions.getActions(),
          groupMap = currentActions.getGroups(),
          group = groupMap.get(cmd);

    // hint history, groups, actions
    if (group == null && args.length < 1) {
      const history = this.#actionStack.items
        .map( key => option(key, '', 'history') );

      const groups = [...groupMap]
        .map( ([key, group]) => option(key, group.desc, 'group') );

      const actions = [];
      actionMap.forEach( (action, key) => {
        if ( key.includes(' ') ) // match group actions by name upon 2 characters
          cmd.length > 1 && actions.push( option(key, action.desc, 'shortcut', [key.split(' ')[1]]) );
        else // match non-group actions
          actions.push( option(key, action.desc, 'action') );
      });

      return this.#list.populate( history.concat(groups, actions), 
        item => this.#createElement(item, [], true), 
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

    return this.#list.populate(options, 
      item => this.#createElement(item, leadingAction), 
      action != null && action.customFilter
        ? action.customFilter(lastArg)
        : standardFilter(lastArg)
    );
  }

  #initEvents() {
    // store action history on stack changes
    this.#actionStack.events.observe('stackChange', () => {
      this.#store.set('stack', this.#actionStack.items);
    });

    // close action palette if clicking out of focus
    this.#background.onclick = (e) => this.toggle(e.target !== this.#background);

    // display hints on value input
    this.#prompt.oninput = () => this.#displayHints();

    // control inputs
    this.#prompt.onkeydown = (e) => {

      // navigate hints
      if (e.key === 'Tab' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = e.key === 'ArrowDown' || e.key === 'Tab' && !e.shiftKey;
        const element = this.#list.navItems(next);
        if (element)
          element.scrollIntoView(false);
      }

      // close when prompt is fully erased
      else if (e.key === 'Backspace' && this.#prompt.getText().length < 1) {
        e.stopImmediatePropagation();
        this.toggle(false);
      }

      // delete history-type hint
      else if (e.key === 'Delete') {
        const selection = this.#list.getSelectedElement();
        if (selection && selection.onForget != null) {
          e.preventDefault();

          const element = this.#list.navItems();
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
        
        const selection = this.#list.getSelectedElement();
        if (selection) {
          selection.onAccess();
          this.#displayHints();
        } else {
          this.toggle(false);
          this.#runAction();
        }
      }
    };
  }
}


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
      : keys.some( str => str.includes(lowerCaseQuery) );

    return itemIsDot 
      ? match && queryIsDot 
      : match;
  }
}


/**
 * Action palette for current context.
 * @type {ActionPalette}
 */
export const actionPalette = /** @type {ActionPalette} */ (document.querySelector(ActionPalette.tagName));

customElements.define(ActionPalette.tagName, ActionPalette);
