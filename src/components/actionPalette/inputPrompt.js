// @ts-check

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
   * @type {(ev: Event) => any}
   */
  onselectionchange = () => null;

  /**
   * @param {HTMLInputElement} inputElement
   */
  constructor(inputElement) {
    this.#input = inputElement;
    this.#input.oninput = (e) => this.oninput(e);
    this.#input.onkeydown = (e) => this.onkeydown(e);
    this.#input.onselectionchange = (e) => this.onselectionchange(e);
  }

  /**
   * Enclose white-spaced words in double-quotes, escape inner ones.
   * ```
   * // becomes: '"path/to/my \"quoted\" file.mp4"'
   * escapeQuoteSpaces('/path/to/my "quoted" file.mp4');
   * ```
   * @param {string} text string to parse.
   * @returns {string} Treated text
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
   * @param {string} text string to parse.
   * @returns {string[]} Array of unescaped strings.
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
      if ( (char === ` ` && separateOnSpace) || isLastChar ) {
        if (buffer.length) {
          output.push(buffer);
          buffer = '';
        }
      }

      // append empty string if signaling new arg
      if (isLastChar) {
        const endInSeparator = char === ` ` && separateOnSpace;
        const endOnOpenQuote = char === `"` && prevChar === ` ` && !separateOnSpace;

        if (endInSeparator || endOnOpenQuote)
          output.push('');
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
   * Complete and replace text at cursor position by default, replace whole string otherwise.
   * @param {string} text Content to insert.
   * @param {boolean} [replaceWhole=false] Either to replace whole string instead.
   */
  setText(text = '', replaceWhole = false) {
    let newText = text;

    if (!replaceWhole) {
      const beforeCursorArray = this.getTextArrayBeforeCursor(),
            afterCursorArray = this.getTextArray().slice(beforeCursorArray.length);

      newText = beforeCursorArray.slice(0, -1).concat(text, afterCursorArray)
        .reduce( (sum, chunk) => `${sum} ${InputPrompt.escapeQuoteSpaces(chunk)}` );
    }

    // append trailing whitespace when applicable to trigger next suggestions
    const lastChar = newText.at(-1);
    if (lastChar != null && lastChar !== '/' && lastChar !== '\\' && lastChar !== ' ')
      newText += ' ';

    // set new value, move cursor and scroll to end of text
    this.#input.value = newText;
    this.#input.scrollLeft = this.#input.scrollWidth; 
    this.#input.setSelectionRange(newText.length, newText.length);
  }

  /**
   * Returns raw input string.
   * @returns {string}
   */
  getText() {
    return this.#input.value;
  }

  /**
   * Returns unescaped input string array.
   * @returns {string[]}
   */
  getTextArray() {
    return InputPrompt.unescapeIntoArray(this.#input.value);
  }

  /**
   * Returns unescaped input string array up to cursor position.
   * @returns {string[]}
   */
  getTextArrayBeforeCursor() {
    const cursorIdx = this.#input.selectionEnd ?? undefined;
    const text = this.#input.value.slice(0, cursorIdx);

    return InputPrompt.unescapeIntoArray(text);
  }
}
