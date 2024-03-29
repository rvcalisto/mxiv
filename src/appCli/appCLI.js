import { ItemList } from "../app/itemList.js";
import { ActionDB } from "../actions/actionDB.js";
import { AppNotifier } from "../app/notifier.js";
import { CmdPrompt, CmdHistory } from "./appCLIPrompt.js";
import { option, optionElement } from "./option.js";
export { option };


/**
 * Descriptive option object for display in AppCmdLine.
 * @typedef {import("./option.js").CmdOption} CmdOption
 */


/**
 * Command line interface for executing app methods. 
 */
class AppCmdLine extends HTMLElement {

  static tagName = 'app-cli'

  /**
   * Hint element list.
   * @type {ItemList}
   */
  #list

  /**
   * Prompt element.
   * @type {CmdPrompt}
   */
  #prompt

  constructor() {
    super()
    this.active = false
  }

  connectedCallback() {
    const fragment = document.getElementById('appCliTemplate').content
    this.attachShadow({ mode: 'open' })
    this.shadowRoot.append( fragment.cloneNode(true) );

    this.#list = this.shadowRoot.getElementById('itemList')
    this.#prompt = new CmdPrompt(this.shadowRoot)

    CmdHistory.sync()
    this.#initEvents()
  }

  /**
   * Toggle visibility. Focus prompt if opening while already open.
   * @param {Boolean} open Open or close CLI.
   * @param {String} optionalStr Open on custom string.
   */
  toggle(open, optionalStr = '') {
    // make elements visible and focusable
    const cmdOverlay = this.shadowRoot.getElementById('cmdOverlay')
    cmdOverlay.style.display = ''

    // focus prompt, set optionalStr & list hints.
    if (open) {
      this.#prompt.focus()
      if (this.active) return

      this.#prompt.setText(optionalStr)
      CmdHistory.sync()
      this.#displayHints()
    } 

    // set state and play fade-in/out animation
    this.active = open
    cmdOverlay.animate([
      { opacity : open ? 0 : 1 },
      { opacity : open ? 1 : 0 }
    ], {
      duration: 150
    }).onfinish = () => {
      if (open) return
      this.#list.populate([]) // clean pages
      cmdOverlay.style.display = 'none'
    }
  }

  /**
   * Run current CLI command.
   * @param {String?} inputStr Custom CLI command.
   */
  #runCmd(inputStr) {
    inputStr = inputStr || this.#prompt.getText()

    const action = CmdPrompt.unescapeIntoArray(inputStr)
    const success = ActionDB.currentFrameActions.run(action)
    if (success) return CmdHistory.store(inputStr)
    
    AppNotifier.notify(`"${action[0]}" is not an action in current context`, 'appCLI')
  }

  /**
   * Erase past commands from history.
   * @param {String?} specificEntry If given, remove only this string from history.
   */
  clearCmdHistory(specificEntry) {
    CmdHistory.remove(specificEntry)
    
    const msg = specificEntry ? 'history item removed' : 'history cleared'
    AppNotifier.notify(msg, specificEntry ? 'appCLI:forget' : 'appCLI:clear')
  }

  /**
   * Repeat last command.
   */
  redoCmd() {
    const historyArray = CmdHistory.items
    if (historyArray.length) this.#runCmd(historyArray[0])
  }

  /**
   * Genereate hint list based on current this.#prompt text.
   */
  async #displayHints() {
    const currentActions = ActionDB.currentFrameActions.asObject()
    let [cmd, ...args] = this.#prompt.getText(true)
    let command = currentActions[cmd]

    // hint action methods / options
    if (command != null && args.length > 0) {
      let options = [], lastArg = args.at(-1)
      
      if (command.methods != null) {
        // hint methods
        if (args.length === 1) 
          options = Object.keys(command.methods)
            .map( key => option(key, command.methods[key].desc) )
        // evaluate method instead of root command
        else if (command.methods[args[0]] != null) {
          command = command.methods[args[0]]
          args = args.slice(1)
        }
      }
      // set options if any and not already populated (by methods)
      if (options.length < 1 && command.options != null)
        options = await command.options(lastArg, args)

      return this.#list.populate(options, item => this.#renderElement(item), 
        command.customFilter ? command.customFilter(lastArg) : standardFilter(lastArg) )
    }

    // hint history + root actions
    const cmdList = Object.keys(currentActions)
      .map( cmd => option(cmd, currentActions[cmd].desc, 'action', true) )
    const histList = CmdHistory.items
      .map( cmd => option(cmd, '', 'history', true) )

    this.#list.populate( histList.concat(cmdList), 
      item => this.#renderElement(item), standardFilter(cmd || '') )
  }

  /**
   * Returns a HTMLElement for this option.
   * @param {CmdOption|String} item Option string or object.
   * @returns {HTMLElement}
   */
  #renderElement(item) {
    if ( typeof(item) !== 'object' ) item = option(item)

    const optionElm = optionElement(item)

    optionElm.onclick = () => {
      this.#prompt.focus()
      const selection = this.#list.pageContainerDiv.getElementsByClassName('selected')[0]
      if (selection) selection.classList.remove('selected')
      optionElm.classList.add('selected')
    };

    optionElm.ondblclick = () => {
      this.#completeSelection()
      this.toggle(false)
      this.#runCmd()
    };

    return optionElm;
  }

  /**
   * Auto complete input value based on selected hint.
   */
  #completeSelection() {
    const selection = this.#list.pageContainerDiv.getElementsByClassName('selected')[0]
    if (!selection) return

    const replace = selection.hint.replace
    this.#prompt.setText(selection.hint.name, replace)
  }

  #initEvents() {
    // close CLI if clicking out of focus
    const overlay = this.shadowRoot.getElementById('cmdOverlay')
    overlay.onclick = (e) => {
      if (e.target === overlay) this.toggle(false)
    }

    // display hints on value input
    this.#prompt.oninput = () => this.#displayHints()

    // control inputs
    this.#prompt.onkeydown = (e) => {

      // navigate hints
      if (e.key === 'Tab' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        const next = e.key === 'ArrowDown' || e.key === 'Tab' && !e.shiftKey
        const element = this.#list.navItems(next)
        if (element) element.scrollIntoView(false)
      }

      // close when prompt is fully erased
      else if (e.key === 'Backspace' && this.#prompt.getText().length < 1) 
        this.toggle(false)

      // delete history-type hint
      else if (e.key === 'Delete') {
        const selection = this.#list.pageContainerDiv.getElementsByClassName('selected')[0]
        if (selection && selection.hint.type === 'history') {
          e.preventDefault()
          const element = this.#list.navItems()
          if (element) element.scrollIntoView(false)

          this.clearCmdHistory(selection.hint.name)
          selection.remove()
        }
      }

      // complete, confirm
      else if (e.key === 'Enter' || e.key === ' ' && e.shiftKey) {
        e.preventDefault()
        e.stopImmediatePropagation()
        
        const selection = this.#list.pageContainerDiv.getElementsByClassName('selected')[0]
        if (selection) {
          this.#completeSelection()
          this.#displayHints()
        } else {
          this.toggle(false)
          this.#runCmd()
        }
      }
    }
  }
}

/**
 * Returns an ItemList filter function for standart options context.
 * @param {String|CmdOption} query ItemList filter query.
 * @returns {(item:String|CmdOption)=>boolean} Filter function.
 */
export function standardFilter(query) {
  return (item) => {
    if ( typeof(item) === 'object' ) item = item.name
    const itemIsDot = item[0] === '.', queryIsDot = query[0] === '.'

    // empty query, show all non-dot-files
    if ( !query.trim() ) return !itemIsDot

    // only show matches if for same item-query category
    const match = item.toLowerCase().includes( query.toLowerCase() )
    return itemIsDot ? match && queryIsDot : match
  }
}


/**
 * Command line interface for application instance.
 * @type {AppCmdLine}
 */
export const AppCLI = document.getElementsByTagName(AppCmdLine.tagName)[0]

customElements.define(AppCmdLine.tagName, AppCmdLine)