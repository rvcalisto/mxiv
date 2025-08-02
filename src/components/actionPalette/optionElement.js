// @ts-check

/**
 * @import { OptionType } from "./actionPalette"
 */


/**
 * Action option HTMLElement.
 */
export class OptionElement extends HTMLElement {

  static tagName = 'option-element';

  /**
   * Option type, icon.
   * @type {OptionType}
   */
  type = 'argument';

  /**
   * Option name, title.
   */
  name = 'option';

  /**
   * Option descriptor.
   */
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
   * @type {string[]?}
   */
  tags = null;
  
  static {
    customElements.define(OptionElement.tagName, OptionElement);
  }

  /**
   * Create and return new OptionElement.
   * @param {OptionType} type
   * @param {string} name
   * @param {string} description
   * @returns {OptionElement}
   */
  static createElement(type, name, description) {
    const element = /** @type {OptionElement} */ (document.createElement(OptionElement.tagName));
    element.type = type;
    element.name = name;
    element.description = description;

    return element;
  }

  connectedCallback() {
    this.#setupBaseElement();

    if (this.tags != null)
      this.append( this.#tagDecorators(this.tags) );
    else if (this.onForget != null)
      this.append( this.#forgetButton() );
  }

  /**
   * Setup base container.
   */
  #setupBaseElement() {
    this.setAttribute('icon', this.type);

    const text = document.createElement('p');
    text.textContent = this.name;

    // description to be applied as attribute for css ::after 
    if (this.description !== '')
      text.setAttribute('desc', this.description);

    this.append(text);
  }

  /**
   * Returns HTMLElement with tagged strings.
   * @param {string[]} tags Tag array.
   * @returns {HTMLElement} 
   */
  #tagDecorators(tags) {
    const element = document.createElement('div');
    element.className = 'accelerators';

    tags.forEach(tag => {
      const hotkey = document.createElement('p');
      hotkey.className = 'itemTag';
      hotkey.textContent = tag;
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
      if (this.onForget != null)
        this.onForget();

      this.remove();
    };

    return element;
  }
}
