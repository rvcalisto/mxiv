/**
 * Stop mouse events and notifies about sync progress.
 */
export class ProgressNotifier {

  /** @type {HTMLElement} */
  #componentRoot;

  /** @type {HTMLDivElement} */
  #overlay; 

  /** @type {HTMLParagraphElement} */
  #label;

  /** @type {HTMLDivElement} */
  #bar;
  
  /** Message to present in label. */
  #defaultMsg = 'Loading';

  /**
   * @param {HTMLElement} rootElement Host component.
   */
  constructor(rootElement) {
    this.#componentRoot = rootElement;
    this.#createElements();
  }

  #createElements() {
    this.#overlay = document.createElement('div');
    this.#overlay.className = 'overlay';
    this.#overlay.style.opacity = '0';
    this.#overlay.style.display = 'none';

    this.#label = document.createElement('p');
    this.#label.className = 'label';
    this.#label.textContent = this.#defaultMsg;

    this.#bar = document.createElement('div');
    this.#bar.className = 'progressBar';
    this.#bar.appendChild(this.#bar.cloneNode(true));
    this.#bar.firstChild.style.background = 'whitesmoke';
    this.#bar.firstChild.style.width = '0%';

    this.#overlay.appendChild(this.#label);
    this.#overlay.appendChild(this.#bar);
    this.#componentRoot.appendChild(this.#overlay);
  }

  /**
   * Change notifier visibility.
   * @param {boolean} [show=true] Either to show or hide notifier.
   * @param {Number} [duration=150] Custom visibility transition duration in ms.
   */
  toggleVisibility(show = true, duration = 150) {
    this.#overlay.style.display = '';
    this.#overlay.animate([
      { opacity: show ? 0 : 1 },
      { opacity: show ? 1 : 0 }
    ], {
      duration: duration
    }).onfinish = () => {
      this.#overlay.style.opacity = show ? '1' : '0';
      this.#overlay.style.display = show ? '' : 'none';
      if (!show) this.#label.textContent = this.#defaultMsg;
      if (!show) this.updateBar(0);
    };
  }

  /**
   * Write message to label.
   * @param {String} newMsg Message.
   */
  updateLabel(newMsg) {
    this.#label.textContent = newMsg;
  }

  /**
   * Draw progress bar based on progress / total.
   * @param {Number} value Current progress value.
   * @param {Number} [total=100] Total progress value.
   */
  updateBar(value, total = 100) {
    const innerBar = this.#bar.firstChild;
    innerBar.style.width = `${(100 * value) / total}%`;
  }
}
