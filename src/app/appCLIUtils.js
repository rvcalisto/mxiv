/** 
 * AppCLI action history.
 */
export const CmdHistory = new class {

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
 * AppCLI prompt component.
 */
export class CmdPrompt {

  /** @type {HTMLInputElement} */
  #input;

  /** @param {HTMLElement} host */
  constructor(host) {

    /** @type {(Event)} */
    this.oninput = () => null;

    /** @type {(KeyboardEvent)} */
    this.onkeydown = () => null;

    this.#input = host.getElementById('cmdInput');
    this.#input.oninput = (e) => this.oninput(e);
    this.#input.onkeydown = (e) => this.onkeydown(e);
  }

  /**
   * Returns string with whitespaces double quoted and escape existing ones.
   * - Ex: `my "quoted" file.mp4` => `"my \"quoted\" file.mp4"`
   * @param {String} text String to parse.
   * @returns {String} Double quotted and escaped string.
   */
  static escapeDoubleQuotes(text) {
    const whiteSpaces = text.split(' ').length > 1;
    return whiteSpaces ? `"${text.replaceAll(`"`, `\\"`)}"` : text;
  }

  /**
   * Split string on whitespaces and unescape existing double quotes.
   * - Ex: `runScript "notify-send \"see you\""` => `['runScript','notify-send "see you"']`
   * @param {String} text String to parse.
   * @returns {String[]} Array of unescaped strings.
   */
  static unescapeIntoArray(text) {
    let output = [], buffer = '', separateOnSpace = true;

    for (let i = 0; i < text.length; i++) {
      const char = text[i], prevChar = text[i - 1], nextChar = text[i + 1], isLastChar = i + 1 === text.length;

      let addToBuffer = true;

      // handle unescaped quotes
      if (char === `"` && prevChar !== `\\`) {
        addToBuffer = false;
        separateOnSpace = !separateOnSpace;
      }

      // handle escaped quotes
      if (char === `\\` && nextChar === `"`) {
        addToBuffer = false;
      }

      // ignore separators
      if (char === ` ` && separateOnSpace) {
        addToBuffer = false;
      }

      // normal char, add
      if (addToBuffer) {
        buffer += char;
      }

      // push buffer on separator or end of line
      if ((char === ` ` && separateOnSpace) || isLastChar) {
        if (buffer.length) {
          output.push(buffer);
          buffer = '';
        }
      }

      // append empty string if signaling new arg
      if (isLastChar) {
        const endInSeparator = char === ` ` && separateOnSpace;
        const endOnOpenQuote = char === `"` && prevChar === ` ` && !separateOnSpace;
        if (endInSeparator || endOnOpenQuote) output.push('');
      }
    }

    // console.log(output)
    return output;
  }

  /**
   * Focus prompt element.
   */
  focus() {
    this.#input.focus();
  }

  /**
   * Set prompt text. Either replace whole string or only last argument.
   * @param {String} text Content to insert.
   * @param {false} replaceWhole Either to replace whole string or only last argument.
   */
  setText(text, replaceWhole = true) {
    let newText = text;

    // correct last string into given text
    if (!replaceWhole && text) {
      const [cmd, ...args] = this.getText(true);
      args.pop();

      newText = `${cmd}`;
      for (const arg of [...args, text]) {
        newText += ` ${CmdPrompt.escapeDoubleQuotes(arg)}`;
      }
    }

    this.#input.value = newText;
    this.#input.scrollLeft = 9999; // scroll to end of text (hopefully)
  }

  /**
   * Returns prompt current text content.
   * @returns {String|String[]}
   */
  getText(asUnescapedArray = false) {
    if (asUnescapedArray)
      return CmdPrompt.unescapeIntoArray(this.#input.value);

    return this.#input.value;
  }
}
