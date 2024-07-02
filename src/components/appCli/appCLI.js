import { ItemList } from "../itemList.js";
import { InputPrompt } from "./inputPrompt.js";
import { PriorityStack } from "./priorityStack.js";
import { OptionElement } from "./optionElement.js";
import { ActionController } from "../../actions/actionController.js";
import { AcceleratorController } from "../../actions/acceleratorController.js";
import { AppNotifier } from "../notifier.js";


/**
 * Descriptive option object for display in AppCmdLine.
 * @typedef OptionObject
 * @property {String} name Option name.
 * @property {String} desc Option description.
 * @property {'action'|'history'|'generic'} type Option type.
 */


/**
 * Command line interface for executing app methods. 
 */
class AppCmdLine extends HTMLElement {

  static tagName = 'app-cli';

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
   * Prompt history.
   * @type {PriorityStack<string>}
   */
  #promptHistory = new PriorityStack('cmdHist');

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
    const fragment = document.getElementById('appCliTemplate').content;
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.append( fragment.cloneNode(true) );

    this.#list = this.shadowRoot.getElementById('itemList');
    this.#prompt = new InputPrompt( this.shadowRoot.getElementById('cmdInput') );
    this.#background = this.shadowRoot.getElementById('cmdOverlay');

    this.#initEvents();
  }

  /**
   * Toggle visibility. Focus prompt if opening while already open.
   * @param {Boolean} open Open or close CLI.
   * @param {String} [optionalStr] Open on custom string.
   */
  toggle(open, optionalStr = '') {
    // make elements visible and focusable
    this.#background.style.display = '';

    // focus prompt, set optionalStr & list hints.
    if (open) {
      this.#prompt.focus();
      if (this.active) return;

      this.#prompt.setText(optionalStr);
      this.#promptHistory.reload();
      this.#displayHints();
    } 

    // set state and play fade-in/out animation
    this.active = open;
    this.#background.animate([
      { opacity : open ? 0 : 1 },
      { opacity : open ? 1 : 0 }
      ], { duration: 150})
      .onfinish = () => {
        // clean pages
        if (!open) {
          this.#list.populate([], this.#createElement);
          this.#background.style.display = 'none';
        } 
      };
  }

  /**
   * Run current CLI command.
   * @param {String} [command] Custom CLI command.
   */
  #runCmd(command) {
    command = command || this.#prompt.getText();
    const action = InputPrompt.unescapeIntoArray(command);

    const success = ActionController.currentFrameActions.run(action);
    if (success) {
      const textItem = command ? command.trim() : '';
      if (textItem !== '' && textItem !== 'cli repeatLast')
        return this.#promptHistory.insert(command);
    }
    
    AppNotifier.notify(`"${action[0]}" is not an action in current context`, 'appCLI');
  }

  /**
   * Erase past commands from history.
   * @param {String} [historyItem] If given, remove only this item from history.
   */
  clearCmdHistory(historyItem) {
    if (historyItem == null) {
      this.#promptHistory.clearAll();
      AppNotifier.notify('history cleared', 'appCLI:clear');
    } else {
      this.#promptHistory.remove(historyItem);
      AppNotifier.notify('history item removed', 'appCLI:forget');
      this.toggle(true); // recapture focus from 'forget' button click
    }
  }

  /**
   * Repeat last command.
   */
  redoCmd() {
    if (this.#promptHistory.items.length > 0)
      this.#runCmd(this.#promptHistory.items[0]);
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
    const frameAccelerators = AcceleratorController.currentFrameAccelerators;
    const keys = frameAccelerators.byAction([...leadingAction, itemOption.name]);
    if (keys.length > 0) element.tags = keys;
    
    if (itemOption.type === 'history') {
      element.onForget = () => this.clearCmdHistory(itemOption.name);
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
      this.#runCmd();
    };

    return element;
  }

  /**
   * Genereate hint list based on current this.#prompt text.
   */
  async #displayHints() {
    const currentActions = ActionController.currentFrameActions.asObject();
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
    const histList = this.#promptHistory.items
      .map( key => option(key, '', 'history') );

    this.#list.populate( histList.concat(cmdList), 
      item => this.#createElement(item, [], true), standardFilter(inputQuery || '') );
  }

  #initEvents() {
    // close CLI if clicking out of focus
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
          this.#runCmd();
        }
      }
    }
  }
}


/**
 * Returns rich option object to be displayed by AppCmdLine.
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
 * Command line interface for application instance.
 * @type {AppCmdLine}
 */
export const AppCLI = /** @type {AppCmdLine} */ (document.querySelector(AppCmdLine.tagName));

customElements.define(AppCmdLine.tagName, AppCmdLine);