// @ts-check

/**
 * @typedef {'none'|'stretch'|'scale'|'width'|'height'} DisplayModes
 */


/**
 * View image/video presentation methods.
 */
export class ViewScreen {

  /**
   * Host View component.
   * @type {import('./view.js').View}
   */
  #view;

  /**
   * Element displayed on start. @type {HTMLElement}
   */
  #emptyView;

  /**
   * @param {import('./view.js').View} view View instance.
   */
  constructor(view) {
    this.#view = view;
    this.#emptyView = this.element; // store default content
  }

  /**
   * Current View image/video element. 
   * - References gets lost as object is replaced every `display()`. 
   * This re-captures it every call.
   * @returns {HTMLImageElement|HTMLVideoElement}
   */
  get element() {
    const shadowRoot = /** @type ShadowRoot */ (this.#view.shadowRoot);
    return /** @type {HTMLImageElement|HTMLVideoElement} */ (shadowRoot.getElementById('view'));
  }

  /**
   * Clear track state, unload media and display content.
   * @param {HTMLElement} [content=this.#emptyView] Content to display, logo by default.
   */
  displayEmpty(content = this.#emptyView) {
    this.#view.trackBar.detach();
    this.#view.media.abLoop(null);

    const view = this.element;
    view.src = '';
    view.replaceWith(content);
  }

  /**
   * Preload and initialize image element events.
   * @param {string} filePath File object.
   * @returns {Promise<boolean>} Display success.
   */
  async displayImage(filePath) {
    // preload content, fail gracefully on error
    const img = document.createElement('img');
    img.src = filePath;
    img.id = 'view';

    const success = await new Promise((resolve) => {
      img.onerror = () => resolve(false);
      img.onload = () => resolve(true);
    });

    if (!success)
      return success;

    // replace previous element, keep mode & scroll position
    const pos = this.#view.scrollBox.pos;
    this.displayEmpty(img);
    this.#postPass(pos);

    img.ondblclick = () => this.#view.events.fire('view:fullscreen');

    return success;
  }

  /**
   * Preload and initialize video element events.
   * @param {string} filePath File object.
   * @returns {Promise<boolean>} Display success.
   */
  async displayVideo(filePath) {
    // preload content, fail gracefully on error
    const vid = document.createElement('video');
    vid.src = filePath;
    vid.id = 'view';

    const success = await new Promise((resolve) => {
      vid.onerror = () => resolve(false);
      vid.oncanplay = () => resolve(true);
    });

    if (!success)
      return success;

    // replace previous element, keep mode & scroll position
    const pos = this.#view.scrollBox.pos;
    this.displayEmpty(vid);
    this.#postPass(pos);

    // obey autoplay property but toggle on for next videos (for restoring videos as paused)
    if (this.#view.autoplay)
      this.#view.media.playToggle(true);

    this.#view.autoplay = true;

    // attach track monitor and recall runtime state
    this.#view.trackBar.attach(vid);
    this.#view.media.setVolume(this.#view.volume * 100);
    this.#view.media.muteToggle(this.#view.mute);
    this.#view.media.onEndRepeat(this.#view.onEnd);

    // set methods
    vid.oncanplay = null; // null event as video seek also triggers it
    vid.oncontextmenu = () => this.#view.media.playToggle();
    vid.ondblclick = () => this.#view.events.fire('view:fullscreen');

    // enforce AB loop or signal end-of-track behavior
    vid.onended = () => {
      if (this.#view.aLoop < Infinity)
        vid.currentTime = this.#view.aLoop;
      else if (this.#view.onEnd !== 'loop')
        this.#view.events.fire(`view:${this.#view.onEnd}`);
    }

    return success;
  }

  /**
   * Increase, decrease and set zoom.
   * @param {string|number} value Ex: `+5`, `-2`, `8`.
   */
  zoom(value) {
    const zoomString = String(value);
    let newValue = parseFloat(zoomString);

    if ( isNaN(newValue) )
      return;

    if (zoomString[0] === '+' || zoomString[0] === '-')
      newValue += this.#view.zoom // relative

    const { x = .5, y = .5 } = this.#view.scrollBox.pos; // fallback center
    this.#view.zoom = Math.max(0, newValue);
    this.#postPass({ x, y });

    this.#view.events.fire('view:zoom');
  }

  /**
   * Apply and preserve element mode styling, scroll position across images.
   * @param {{ x?: number, y?: number; }} [pos=this.#view.scrollBox.pos] Custom scroll position.
   */
  #postPass(pos = this.#view.scrollBox.pos) {
    const { x = 0, y = 0 } = pos; // fallback to top-left

    const element = this.element, zoom = this.#view.zoom;

    switch (this.#view.mode) {
      case 'none':
        const nativeHeight = element.tagName === 'IMG'
          ? /** @type {HTMLImageElement} */ (element).naturalHeight
          : /** @type {HTMLVideoElement} */ (element).videoHeight

        element.style.height = `${nativeHeight * (zoom * .01)}px`;
        element.style.width = 'auto';
        element.style.objectFit = 'unset';
        break;

      case 'stretch':
        element.style.height = `${zoom}%`;
        element.style.width = `${zoom}%`;
        element.style.objectFit = 'unset';
        break;

      case 'scale':
        element.style.height = `${zoom}%`;
        element.style.width = `${zoom}%`;
        element.style.objectFit = 'contain';
        break;

      case 'width':
        element.style.height = 'auto';
        element.style.width = `${zoom}%`;
        element.style.objectFit = 'unset';
        break;

      case 'height':
        element.style.height = `${zoom}%`;
        element.style.width = 'auto';
        element.style.objectFit = 'unset';
        break;
    }

    // restore scroll position without animation
    this.#view.scrollBox.pos = { x, y, behavior: 'auto' };
  }

  /**
   * Reset zoom, apply mode and update state. Emits a message on screen. 
   * @param {DisplayModes} mode View mode.
   */
  setViewMode(mode) {
    this.#view.zoom = 100;
    this.#view.mode = mode;
    this.#postPass();

    this.#view.events.fire('view:notify', `fit-${mode}`, 'fitMode');
    this.#view.events.fire('view:mode', mode);
  }

  /**
   * Cycle between view modes.
   * @param {boolean} [forward=true] Direction.
   */
  cycleViewMode(forward = true) {
    const modes = /** @type {DisplayModes[]} */ (['none', 'stretch', 'scale', 'width', 'height']);

    const nextIdx = modes.indexOf(this.#view.mode) + (forward ? 1 : -1);
    const newMode = modes.at(nextIdx % modes.length); // wrap around
    this.setViewMode( /** @type {DisplayModes} */ (newMode) );
  }
}
