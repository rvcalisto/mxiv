import { ItemList } from "./itemList.js";
import { Tab, FRAME } from "./tabs.js";
import { Accelerators, Actions } from "./actionTools.js";
import { AppNotifier } from "./notifier.js";

/** AppCLI action history. */
const actionHistory = new class {

  /** @type {String[]} */
  #history = []
  #historySize = 10
  #historyStorage = 'cmdHist'

  constructor() {
    this.sync()
  }

  /** In order of last stored. Read-only. */
  get items() {
    return this.#history
  }

  /**
   * Sync history with localStorage. Keeps different windows in sync.
   */
  sync() {
    const lclStr = JSON.parse(localStorage.getItem(this.#historyStorage))
    this.#history = lclStr || []
  }

  /**
   * Store action & args string item.
   * @param {String} cmdStr Command string to store.
   */
  store(cmdStr) {
    cmdStr = cmdStr.trim()
    if (!cmdStr || cmdStr === 'cli repeatLast') return

    // move to top if already in history, else add to top and trim array
    if (this.#history.includes(cmdStr)) {
      const idx = this.#history.indexOf(cmdStr)
      this.#history.splice(idx, 1)
      this.#history.unshift(cmdStr)
    } else {
      const newLength = this.#history.unshift(cmdStr)
      if (newLength > this.#historySize) this.#history.length = this.#historySize
    }

    // write changes to localStorage
    localStorage.setItem(this.#historyStorage, JSON.stringify(this.#history))
  }

  /**
   * Erase exact item from history. Erase all items if undefined.
   * @param {String?} specificEntry If given, remove only this string from history.
   */
  remove(specificEntry) {
    this.#history = specificEntry ? this.#history.filter(entry => entry !== specificEntry) : []
    localStorage.setItem(this.#historyStorage, JSON.stringify(this.#history))
  }
}


/**
 * Command line interface for executing app methods. 
 */
class AppCmdLine extends HTMLElement {

  static tagName = 'app-cli'

  #commandListCache = {}; #lastActionedFrameType

  /** Hint element list. @type {ItemList} */
  #list
  /** Input text element. @type {HTMLInputElement} */
  #input

  constructor() {
    super()
    this.active = false
  }

  connectedCallback() {
    const fragment = document.getElementById('appCliTemplate').content
    this.attachShadow({mode: 'open'})
    this.shadowRoot.append(fragment.cloneNode(true));

    this.#input = this.shadowRoot.getElementById('cmdInput')
    this.#list = this.shadowRoot.getElementById('itemList')

    actionHistory.sync()
    this.#initializeInputs()
  }

  /**
   * All actionable actions for current component.
   * @returns {Object<string, import("./actionTools.js").ActionObject>}
   */
  get #commandList() {
    const frame = FRAME.constructor.name.toLowerCase()
    if (this.#lastActionedFrameType !== frame) {
      this.#commandListCache = Actions.byOwner(`${frame}-all`)
      this.#lastActionedFrameType = frame
    }
    
    return this.#commandListCache
  }

  /**
   * Toggle cmd element visibility.
   * @param {Boolean} open Open or close cmd element.
   * @param {String} optionalStr Open on command string.
   */
  toggle(open, optionalStr = '') {
    // make elements visible and focusable
    const cmdOverlay = this.shadowRoot.getElementById('cmdOverlay')
    cmdOverlay.style.display = ''

    // focus input, set optionalStr & list hints. Exit after focus if already open
    if (open) {
      this.#input.focus()
      if (this.active) return

      this.#input.value = optionalStr
      actionHistory.sync()
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
    inputStr = inputStr || this.#input.value

    const frame = FRAME.constructor.name.toLowerCase()
    const action = parseFromCLI(inputStr)
    
    const success = Actions.run(`${frame}-all`, action)
    if (success) return actionHistory.store(inputStr)
    
    console.log(`appCLI: "${action[0]}" action doesn't exist for ${frame}`);
    AppNotifier.notify(`"${action[0]}" is not an action`, 'appCLI')
  }

  /**
   * Erase past commands from history.
   * @param {String?} specificEntry If given, remove only this string from history.
   */
  clearCmdHistory(specificEntry) {
    actionHistory.remove(specificEntry)
    
    const msg = specificEntry ? 'history item removed' : 'history cleared'
    AppNotifier.notify(msg, specificEntry ? 'appCLI:forget' : 'appCLI:clear')
  }

  /**
   * Repeat last command.
   */
  redoCmd() {
    const historyArray = actionHistory.items
    if (historyArray.length) this.#runCmd(historyArray[0])
  }

  /**
   * Genereate hint list based on current prompt text.
   */
  async #displayHints() {
    let [cmd, ...args] = parseFromCLI(this.#input.value)
    let command = this.#commandList[cmd]

    // hint action methods / options
    if (command && args.length) {
      let options = [], lastArg = args.at(-1)

      if (command.methods && args.length === 1) {
        options = Object.keys(command.methods)
        .map(key => cmdLineItem(key, command.methods[key].desc))
      }

      else if (command.methods && command.methods[args[0]]) {
        command = command.methods[args[0]]
        args = args.slice(1)
      }

      if (!options.length && command.options) options = await command.options(lastArg, args)

      // list options
      // console.time('populate')
      this.#list.populate(options, (item) => this.#hintElement(item), 
      command.customFilter ? command.customFilter(lastArg) : standardFilter(lastArg))
      // console.timeEnd('populate')
      return 
    }

    // hint history + root actions
    const cmdList = Object.keys(this.#commandList)
    .map( cmd => cmdLineItem(cmd, this.#commandList[cmd].desc, 'action', true) )

    const histList = actionHistory.items
    .map( cmd => cmdLineItem(cmd, '', 'history', true) )

    this.#list.populate(histList.concat(cmdList), 
    (item) => this.#hintElement(item), standardFilter(cmd || ''))
  }

  /**
   * Create and return hint element. Defaults to overwrite.
   * @param {String|Object} item Item text.
   * @returns {HTMLElement}
   */
  #hintElement(item) {
    if (typeof(item) !== "object") item = cmdLineItem(item)

    const hint = document.createElement('div')
    hint.hint = item // set reference
    hint.setAttribute('icon', item.type)

    const text = document.createElement('p')
    text.className = 'itemText'
    text.textContent = item.key

    // description to be applied as atribute for css ::after 
    if (item.desc) text.setAttribute('desc', item.desc)
    hint.append(text)

    if (item.type === 'action') {
      const frame = FRAME.constructor.name.toLowerCase()
      const acceleratedBy = Accelerators.byAction(`${frame}-all`, [item.key])

      if (acceleratedBy.length) {
        const hotkeyDiv = document.createElement('div')
        hotkeyDiv.className = 'accelerators'

        acceleratedBy.forEach(key => {
          const hotkey = document.createElement('p')
          hotkey.className = 'itemTag'
          hotkey.textContent = key
          hotkeyDiv.appendChild(hotkey)
        })
        hint.append(hotkeyDiv)
      }
    }

    if (item.type === 'history') {
      const delBtn = document.createElement('button')
      delBtn.className = 'itemTag'
      delBtn.textContent = 'forget' // '✖️'
      hint.appendChild(delBtn)

      delBtn.onclick = (e) => {
        AppCLI.clearCmdHistory(item.key)
        hint.remove()

        this.toggle(true)
        e.stopImmediatePropagation()
      }
    }

    hint.onclick = () => {
      this.#input.focus()
      const selection = this.#list.pageContainerDiv.getElementsByClassName('selected')[0]
      if (selection) selection.classList.remove('selected')
      hint.classList.add('selected')
    }

    hint.ondblclick = () => {
      this.#completeSelection()
      this.toggle(false)
      this.#runCmd()
    }

    return hint
  }

  /**
   * Auto complete input value based on selected hint.
   */
  #completeSelection() {
    const selection = this.#list.pageContainerDiv.getElementsByClassName('selected')[0]
    if (!selection) return

    const [cmd, ...args] = parseFromCLI(this.#input.value)
    let newLine = ''

    if (selection.hint.replace) {
      newLine = selection.hint.key
    } else {
      // remove last argument that were going to handle
      args.pop()

      let lastArgs = `${cmd}`
      for (const arg of args) lastArgs += ` ${parseToCLI(arg)}`
      newLine = `${lastArgs} ${parseToCLI(selection.hint.key)}`
    }

    this.#input.value = newLine
    this.#input.scrollLeft = 9999 // scroll to end of text (hopefully)
  }

  #initializeInputs() {
    // close CLI if clicking out of focus
    const overlay = this.shadowRoot.getElementById('cmdOverlay')
    overlay.onclick = (e) => {
      if (e.target === overlay) this.toggle(false)
    }

    // creates/updates hintPanel
    this.#input.oninput = () => this.#displayHints()

    // input functions
    this.#input.onkeydown = (e) => {

      // navigate hints
      if (e.key === 'Tab' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        const next = e.key === 'ArrowDown' || e.key === 'Tab' && !e.shiftKey
        const element = this.#list.navItems(next)
        if (element) element.scrollIntoView(false)
      }

      // close when cmd is fully erased
      if (e.key === 'Backspace' && !this.#input.value.length) this.toggle(false)

      // delete history type hint
      if (e.key === 'Delete') {
        const selection = this.#list.pageContainerDiv.getElementsByClassName('selected')[0]
        if (!selection || selection.hint.type !== 'history') return

        e.preventDefault()
        const element = this.#list.navItems()
        if (element) element.scrollIntoView(false)

        this.clearCmdHistory(selection.hint.key)
        selection.remove()
      }

      // completion & confirmation 
      if (e.key === 'Enter' || e.key === ' ' && e.shiftKey) {
        e.preventDefault()
        e.stopImmediatePropagation()
        
        const selection = this.#list.pageContainerDiv.getElementsByClassName('selected')[0]
        if (selection) {
          this.#completeSelection()
          this.#displayHints()
          return
        }

        this.toggle(false)
        this.#runCmd()
      }
    }
  }
}

/**
 * Returns a rich AppCmdLine option item.
 * @param {String} key Entry as its displayed.
 * @param {String} desc Item description.
 * @param {'action'|'history'|'generic'|?} type Item type.
 * @param {false} replace Either to completely replace input field or complete.
 */
export function cmdLineItem(key, desc = '', type = 'generic', replace = false) {
  return {
    key: key,
    desc: desc,
    type: type,
    replace: replace
  }
}

/**
 * Returns an ItemList filter function for standart options context.
 * @param {String} query ItemList filter query.
 * @returns {(item)=>{}} Filter function.
 */
export function standardFilter(query) {
  return (item) => {
    if (typeof(item) === 'object') item = item.key
    const itemIsDot = item[0] === '.', queryIsDot = query[0] === '.'

    // empty query, show all non-dot-files
    if (!query.trim()) return !itemIsDot

    // only show matches if for same item-query category
    const match = item.toLowerCase().includes(query.toLowerCase())
    return itemIsDot ? match && queryIsDot : match
  }
}

/**
 * Parse escaped double quotes into a command and arguments array.
 * - Ex: `runScript "notify-send \"see you\""` => `['runScript','notify-send','see you']`
 * @param {String} text 
 * @returns {String[]}
 */
function parseFromCLI(text) {
  let output = [], buffer = '', separateOnSpace = true
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i], prevChar = text[i-1], 
    nextChar = text[i+1], isLastChar = i +1 === text.length

    let addToBuffer = true
    
    // handle unescaped quotes
    if (char === `"` && prevChar !== `\\`) {
      addToBuffer = false
      separateOnSpace = !separateOnSpace
    }
    
    // handle escaped quotes
    if (char === `\\` && nextChar === `"`) {
      addToBuffer = false
    }
    
    // ignore separators
    if (char === ` ` && separateOnSpace) {
      addToBuffer = false
    }
    
    // normal char, add
    if (addToBuffer) {
      buffer += char
    }

    // push buffer on separator or end of line
    if ( (char === ` ` && separateOnSpace) || isLastChar) {
      if (buffer.length) {
        output.push(buffer)
        buffer = ''
      }
    }

    // append empty string if signaling new arg
    if (isLastChar) {
      const endInSeparator = char === ` ` && separateOnSpace
      const endOnOpenQuote = char === `"` && prevChar === ` ` && !separateOnSpace
      if (endInSeparator || endOnOpenQuote) output.push('')
    }
  }
  
  // console.log(output)
  return output
}

/**
 * Parse strings with whitespaces as quoted arguments. Escape inner quotes if any.
 * @param {String} text 
 * @returns {String}
 */
function parseToCLI(text) {
  const whiteSpaces = text.split(' ').length > 1
  return whiteSpaces ? `"${text.replaceAll(`"`, `\\"`)}"` : text
}

/**
 * Command line interface for application instance.
 * @type {AppCmdLine}
 */
export const AppCLI = document.getElementsByTagName(AppCmdLine.tagName)[0]


customElements.define(AppCmdLine.tagName, AppCmdLine)