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

    // replace previous element with new image
    this.displayEmpty(img);

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

    // replace previous element with new video
    this.displayEmpty(vid);

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
   * Apply mode style property values to img element.
   * @param {DisplayModes} mode View mode. 
   */
  #applyMode(mode) {
    const img = this.element, zoom = this.#view.zoom;

    switch (mode) {
      case 'none':
        const nativeHeight = img.tagName === 'IMG'
          ? /** @type {HTMLImageElement} */ (img).naturalHeight
          : /** @type {HTMLVideoElement} */ (img).videoHeight

        img.style.height = `${nativeHeight * (zoom * .01)}px`;
        img.style.width = 'auto';
        img.style.objectFit = 'unset';
        break;

      case 'stretch':
        img.style.height = `${zoom}%`;
        img.style.width = `${zoom}%`;
        img.style.objectFit = 'unset';
        break;

      case 'scale':
        img.style.height = `${zoom}%`;
        img.style.width = `${zoom}%`;
        img.style.objectFit = 'contain';
        break;

      case 'width':
        img.style.height = 'auto';
        img.style.width = `${zoom}%`;
        img.style.objectFit = 'unset';
        break;

      case 'height':
        img.style.height = `${zoom}%`;
        img.style.width = 'auto';
        img.style.objectFit = 'unset';
        break;
    }
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
      newValue = this.#view.zoom + newValue; // relative

    this.#view.zoom = Math.max(0, newValue);

    this.postPass();
    this.#view.events.fire('view:zoom');
  }

  /**
   * Re-evaluates current mode method on img load & zoom, preserves scroll position.
   * Needed to preserve resource dependent properties such as `height: img.nativeHeight` across images.
   */
  postPass() {
    // remember scroll position if any, else focus middle (defaults to .5)
    const { x = .5, y = .5 } = this.#view.scrollBox.pos;

    this.#applyMode(this.#view.mode);

    // restore scroll position without animation
    this.#view.scrollBox.pos = { x: x, y: y, behavior: 'auto' };
  }

  /**
   * Reset zoom, apply mode and update state. Emits a message on screen. 
   * @param {DisplayModes} mode View mode.
   */
  setViewMode(mode) {
    this.#view.zoom = 100;
    this.#applyMode(mode);
    this.#view.mode = mode;

    this.#view.events.fire('view:notify', `fit-${mode}`, 'fitMode');
    this.#view.events.fire('view:mode', mode);
  }

  /**
   * Cycle between view modes.
   * @param {boolean} [forward=true] Direction.
   */
  cycleViewMode(forward = true) {
    /** @type {DisplayModes[]} */ 
    const modes = ['none', 'stretch', 'scale', 'width', 'height'];

    let nextIdx = modes.indexOf(this.#view.mode) + (forward ? 1 : -1);
    nextIdx = nextIdx < 0 ? modes.length -1 : nextIdx % (modes.length); // wrap around
    this.setViewMode(modes[nextIdx]);
  }
}
