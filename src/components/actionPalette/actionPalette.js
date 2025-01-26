import { ItemList } from "../itemList.js";
import { InputPrompt } from "./inputPrompt.js";
import { PriorityStack } from "./priorityStack.js";
import { OptionElement } from "./optionElement.js";
import { actionService } from "../../actions/actionService.js";
import { acceleratorService } from "../../actions/acceleratorService.js";
import { appNotifier } from "../notifier.js";
import { GenericStorage } from "../genericStorage.js";


/**
 * Descriptive option object for display in ActionPalette.
 * @typedef OptionObject
 * @property {String} name Option name.
 * @property {String} desc Option description.
 * @property {'action'|'history'|'generic'} type Option type.
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
    const fragment = document.getElementById('actionPaletteTemplate').content;
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.append( fragment.cloneNode(true) );

    this.#list = this.shadowRoot.getElementById('itemList');
    this.#prompt = new InputPrompt( this.shadowRoot.getElementById('cmdInput') );
    this.#background = this.shadowRoot.getElementById('cmdOverlay');

    this.#initEvents();
  }

  /**
   * Toggle visibility. Focus prompt if opening while already open.
   * @param {Boolean} open Open or close action palette.
   * @param {String} [optionalStr] Open on custom string.
   */
  toggle(open, optionalStr = '') {
    // make elements visible and focusable
    this.#background.style.display = '';

    // focus prompt, sync action history between windows, set text & list hints.
    if (open) {
      this.#prompt.focus();
      if (this.active) return;

      const historyStack = this.#store.get('stack');
      if (historyStack) this.#actionStack.items = historyStack;
      
      this.#prompt.setText(optionalStr);
      this.#displayHints();
    } 

    // set state, play fade-in/out animation and clear list on close
    this.active = open;
    this.#background.animate([
      { opacity : open ? 0 : 1 },
      { opacity : open ? 1 : 0 }
      ], { duration: 150})
      .onfinish = () => {
        if (open) return;

        this.#list.populate([], this.#createElement);
        this.#background.style.display = 'none';
      };
  }

  /**
   * Run given action text, otherwise get it from input.
   * @param {String} [actionText] Optional action text.
   */
  #runAction(actionText) {
    actionText = actionText || this.#prompt.getText();
    const action = InputPrompt.unescapeIntoArray(actionText);

    if (action.length < 1)
      return; 

    const success = actionService.currentFrameActions.run(action);
    if (success) {
      const textItem = actionText.trim();
      if (textItem !== 'palette repeatLast')
        this.#actionStack.insert(textItem);
    } else {
      appNotifier.notify(`"${action[0]}" is not an action in current context`, 'actionPalette');
    }
  }

  /**
   * Erase past executed action or actions from history.
   * @param {String} [historyItem] If given, remove only this item from history.
   */
  clearActionHistory(historyItem) {
    if (historyItem == null) {
      this.#actionStack.clearAll();
      appNotifier.notify('history cleared', 'actionPalette:clear');
    } else {
      this.#actionStack.remove(historyItem);
      appNotifier.notify('history item removed', 'actionPalette:forget');
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
   * @param {OptionObject|String} item Option string or object.
   * @param {string[]} [leadingAction] Action being evaluated.
   * @param {boolean} [replace=false] Either option replaces input prompt.
   * @returns {OptionElement}
   */
  #createElement(item, leadingAction = [], replace = false) {
    const itemOption = (typeof item === 'string') ? option(item) : item;
    const element = OptionElement.createElement(itemOption);

    // tag accelerators keys, if any
    const frameAccelerators = acceleratorService.currentFrameAccelerators;
    element.tags = frameAccelerators.byAction([...leadingAction, itemOption.name]);
    
    if (itemOption.type === 'history') {
      element.onForget = () => this.clearActionHistory(itemOption.name);
    }

    element.onclick = () => {
      this.#list.selectIntoFocus(element, false);
      this.#prompt.focus();
    };

    element.onAccess = () => {
      this.#prompt.setText(itemOption.name, replace);
    };

    element.ondblclick = () => {
      element.onAccess();
      this.toggle(false);
      this.#runAction();
    };

    return element;
  }

  /**
   * Genereate hint list based on current this.#prompt text.
   */
  async #displayHints() {
    const currentActions = actionService.currentFrameActions.asObject();
    const inputTextArray = this.#prompt.getTextArray();
    let [cmd, ...args] = inputTextArray;
    let action = currentActions[cmd];

    // hint history + root actions
    if (action == null || args.length < 1) {
      this.#defaultHints(currentActions, cmd);
      return;
    }

    // hint action methods / options
    let options = [], lastArg = /** @type {String} */ (args.at(-1));
    const leadingAction = inputTextArray.slice(0, -1);
    const actionMethods = action.methods;
    
    if (actionMethods != null) {
      // hint methods
      if (args.length === 1) {
        options = Object.keys(actionMethods)
          .map( key => option(key, actionMethods[key].desc, 'action') );
      }
      // evaluate method as action
      else if (actionMethods[args[0]] != null) {
        const methodName = /** @type {string} */ (args.shift());
        action = actionMethods[methodName];
      }
    }

    // set options if any and not already populated (by methods)
    if (options.length < 1 && action.options != null)
      options = await action.options(lastArg, args);

    return this.#list.populate(options, item => this.#createElement(item, leadingAction), 
      action.customFilter ? action.customFilter(lastArg) : standardFilter(lastArg) );
  }

  /**
   * Hint history plus root actions.
   * @param {import('../../actions/componentActions.js').ActionSet} actions 
   * @param {String} inputQuery 
   */
  #defaultHints(actions, inputQuery) {
    const cmdList = Object.keys(actions)
      .map( key => option(key, actions[key].desc, 'action') );
    const histList = this.#actionStack.items
      .map( key => option(key, '', 'history') );

    this.#list.populate( histList.concat(cmdList), 
      item => this.#createElement(item, [], true), standardFilter(inputQuery || '') );
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
        if (element) element.scrollIntoView(false);
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
          if (element) element.scrollIntoView(false);

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
 * @param {String} name Option name.
 * @param {String} [desc] Option description.
 * @param {'action'|'history'|'generic'} [type='generic'] Option type.
 * @returns {OptionObject}
 */
export function option(name, desc = '', type = 'generic') {
  return {
    name: name,
    desc: desc,
    type: type
  };
}

/**
 * Returns an ItemList filter function for standart options context.
 * @param {String} query ItemList filter query.
 * @returns {(item:String|OptionObject)=>boolean} Filter function.
 */
export function standardFilter(query) {
  return (item) => {
    if (typeof item !== 'string') item = item.name;
    const itemIsDot = item[0] === '.', queryIsDot = query[0] === '.';

    // empty query, show all non-dot-files
    if ( !query.trim() ) return !itemIsDot;

    // only show matches if for same item-query category
    const match = item.toLowerCase().includes( query.toLowerCase() );
    return itemIsDot ? match && queryIsDot : match;
  }
}


/**
 * Action palette for current context.
 * @type {ActionPalette}
 */
export const actionPalette = /** @type {ActionPalette} */ (document.querySelector(ActionPalette.tagName));

customElements.define(ActionPalette.tagName, ActionPalette);
