/**
 * @typedef {import('./appCLI').OptionObject} OptionObject
 */


/**
 * Action option HTMLElement.
 */
export class OptionElement extends HTMLElement {

  static tagName = 'option-element';

  type = 'generic'

  name = 'option'

  description = ''

  /**
   * Forget callback.
   * @type {(()=>void)?}
   */
  onForget;

  /**
   * Access callback.
   * @type {()=>void}
   */
  onAccess;

  /**
   * Tag decorators.
   * @type {string[]}
   */
  tags = [];
  
  static {
    customElements.define(OptionElement.tagName, OptionElement);
  }

  /**
   * Create and return new OptionElement.
   * @param {OptionObject} itemOption
   * @returns {OptionElement}
   */
  static createElement(itemOption) {
    const element = /** @type {OptionElement} */ (document.createElement(OptionElement.tagName));
    element.type = itemOption.type;
    element.name = itemOption.name;
    element.description = itemOption.desc;
    
    return element;
  }

  connectedCallback() {
    this.#setupBaseElement();
    
    if (this.tags.length > 0)
      this.append( this.#tagDecorators() );
    else if (this.onForget != null)
      this.append( this.#forgetButton() );
  }

  /**
   * Setup base container.
   */
  #setupBaseElement() {
    this.setAttribute('icon', this.type);

    const text = document.createElement('p');
    text.className = 'itemText';
    text.textContent = this.name;

    // description to be applied as atribute for css ::after 
    if (this.description !== '')
      text.setAttribute('desc', this.description);

    this.append(text);
  }

  /**
   * Returns HTMLElement with tagged strings.
   * @returns {HTMLElement} 
   */
  #tagDecorators() {
    const element = document.createElement('div');
    element.className = 'accelerators';

    this.tags.forEach(key => {
      const hotkey = document.createElement('p');
      hotkey.className = 'itemTag';
      hotkey.textContent = key;
      element.appendChild(hotkey);
    });

    return element;
  }

  /**
   * Returns HTMLButtonElement to remove and forget current option.
   * @returns {HTMLButtonElement}
   */
  #forgetButton() {
    const element = document.createElement('button');
    element.className = 'itemTag';
    element.textContent = 'forget'; // '✖️'

    element.onclick = (e) => {
      e.stopImmediatePropagation();
      if (this.onForget != null) this.onForget();
      this.remove();
    };

    return element;
  }
}
