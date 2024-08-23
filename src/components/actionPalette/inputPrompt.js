/**
 * ActionPalette input prompt component.
 */
export class InputPrompt {

  /** 
   * @type {HTMLInputElement}
   */
  #input;

  /**
   * @type {(ev: Event) => any}
   */
  oninput = () => null;

  /**
   * @type {(ev: KeyboardEvent) => any}
   */
  onkeydown = () => null;

  /**
   * @param {HTMLInputElement} inputElement
   */
  constructor(inputElement) {
    this.#input = inputElement;
    this.#input.oninput = (e) => this.oninput(e);
    this.#input.onkeydown = (e) => this.onkeydown(e);
  }

  /**
   * Enclose white-spaced words in double-quotes, escape inner ones.
   * ```
   * // becomes: '"path/to/my \"quoted\" file.mp4"'
   * escapeQuoteSpaces('/path/to/my "quoted" file.mp4');
   * ```
   * @param {String} text String to parse.
   * @returns {String} Treated text
   */
  static escapeQuoteSpaces(text) {
    text = text.trim();
    if ( !text.includes(' ') )
      return text;
    
    // identify path separators, get words
    let pathSep = '', /** @type {string[]} */ words =  [];
    for (const sep of ['/', '\\']) {
      words = text.split(sep);
      if (words.length > 1) {
        pathSep = sep;
        break;
      }
    }
    
    let treatedText = '';
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if ( word.includes(' ') )
        treatedText += `"${word.replaceAll('"', '\\"')}"`;
      else
        treatedText += word;
      
      if (i < words.length -1)
        treatedText += pathSep;
    }
    
    return treatedText;
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
      const char = text[i], prevChar = text[i - 1], 
      nextChar = text[i + 1], isLastChar = i + 1 === text.length;

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
   * @param {Boolean} [replaceWhole=true] Either to replace whole string or only last argument.
   */
  setText(text, replaceWhole = true) {
    let newText = text;

    // correct last string into given text
    if (!replaceWhole && text) {
      const [cmd, ...args] = this.getTextArray();
      args.pop();

      newText = `${cmd}`;
      for (const arg of [...args, text]) {
        newText += ` ${InputPrompt.escapeQuoteSpaces(arg)}`;
      }
    }
    
    // append trailing whitespace when applicable to trigger next suggestions
    const lastChar = newText.at(-1);
    if (lastChar != null && lastChar !== '/' && lastChar !== '\\')
      newText += ' ';

    this.#input.value = newText;
    this.#input.scrollLeft = 9999; // scroll to end of text (hopefully)
  }

  /**
   * Returns raw input string.
   * @returns {String}
   */
  getText() {
    return this.#input.value;
  }

  /**
   * Returns unescaped input string array.
   * @returns {String[]}
   */
  getTextArray() {
    return InputPrompt.unescapeIntoArray(this.#input.value);
  }
}
