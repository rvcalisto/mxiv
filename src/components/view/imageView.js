/**
 * View methods image related, but not exclusive, content.
 */
export class ImageView {

  /** Parent View component.
   * @type {import('./view.js').View} */
  #view

  /**
   * Composed image element class.
   * @param {import('./view.js').View} view View instance.
   */
  constructor(view) {
    this.#view = view
  }

  /**
   * Preload and initialize image element events.
   * @param {String} filePath File object.
   * @returns {Promise<Boolean>} Display success.
   */
  async display(filePath) {

    // preload content, fail gracefully on error
    const img = document.createElement('img')
    img.src = filePath
    img.id = 'view'

    const success = await new Promise((resolve) => {
      img.onerror = () => resolve(false)
      img.onload = () => resolve(true)
    })
    
    if (!success) return success
    
    this.#view.vidView.trackBar.detach()
    this.#view.vidView.abLoop(null)
  
    // replace previous element with new image
    this.#view.shadowRoot.getElementById('view').replaceWith(img)

    img.ondblclick = () => this.#view.signalEvent('view:fullscreen')
    
    return success
  }
  

  /**
   * View image/video element. 
   * - References gets lost as object is replaced every `display()`. 
   * This re-captures it every call.
   * @returns {HTMLImageElement|HTMLMediaElement}
   */
  get img() {
    return this.#view.shadowRoot.getElementById('view');
  }


  /**
   * Apply mode style property values to img element.
   * @param {'none'|'stretch'|'scale'|'width'|'height'} mode View mode. 
   */
  #applyMode(mode) {
    const img = this.img, zoom = this.#view.zoom

    switch (mode) {
      
      case 'none':
        const nativeHeight = img.tagName === 'IMG' ? img.naturalHeight : img.videoHeight
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
        break
    
      case 'width':
        img.style.height = 'auto';
        img.style.width = `${zoom}%`;
        img.style.objectFit = 'unset';
        break
    
      case 'height':
        img.style.height = `${zoom}%`;
        img.style.width = 'auto';
        img.style.objectFit = 'unset';
        break
    }
  }


  /**
   * Increase, decrease and set zoom.
   * @param {String|Number} value Ex: `+5`, `-2`, `8`.
   */
  zoom(value) {
    const sign = String(value)[0]
    let newValue = parseFloat(value)
    if (sign === '+' || sign === '-') {
      newValue = this.#view.zoom + newValue
    }
    this.#view.zoom = Math.max(0, newValue);
    
    this.postPass();
    this.#view.signalEvent('view:zoom')
  }


  /**
   * Re-evaluates current mode method on img load & zoom, preserves scroll position.
   * Needed to preserve resource dependent properties such as `height: img.nativeHeight` across images.
   */
  postPass() {
    // remember scroll position if any, else focus middle (defaults to .5)
    const { x = .5, y = .5 } = this.#view.scrollBox.pos

    this.#applyMode(this.#view.mode);

    // restore scroll position without animation
    this.#view.scrollBox.pos = { x: x, y: y, behavior: 'auto' };
  }


  /**
   * Reset zoom, apply mode and update state. Emits a message on screen. 
   * @param {'none'|'stretch'|'scale'|'width'|'height'} mode View mode.
   */
  setViewMode(mode) {
    this.#view.zoom = 100;
    this.#applyMode(mode);
    this.#view.mode = mode;

    this.#view.osdMsg(`fit-${mode}`, 'fitMode')
    this.#view.signalEvent('view:mode', mode)
  }


  /**
   * Cycle between view modes.
   * @param {Boolean} forward Direction.
   */
  cycleViewMode(forward = true) {
    const modes = ['none', 'stretch', 'scale', 'width', 'height']

    let nextIdx = modes.indexOf(this.#view.mode) + (forward ? 1 : -1)
    nextIdx = nextIdx < 0 ? modes.length -1 : nextIdx % (modes.length) // wrap around
    this.setViewMode(modes[nextIdx])
  }
}

