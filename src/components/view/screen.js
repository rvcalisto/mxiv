/**
 * View image/video presentation methods.
 */
export class ViewScreen {

  /**
   * Host View component.
   * @type {import('./view.js').View}
   */
  #view

  /**
   * Element displayed on start. @type {HTMLElement}
   */
  #emptyView

  /**
   * @param {import('./view.js').View} view View instance.
   */
  constructor(view) {
    this.#view = view
    this.#emptyView = this.img // store default content
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
   * Display default View content.
   */
  displayEmpty() {
    this.#view.trackBar.detach()
    this.#view.media.abLoop(null)

    this.img.outerHTML = this.#emptyView.outerHTML
  }

  /**
   * Preload and initialize image element events.
   * @param {String} filePath File object.
   * @returns {Promise<Boolean>} Display success.
   */
  async displayImage(filePath) {
    // preload content, fail gracefully on error
    const img = document.createElement('img')
    img.src = filePath
    img.id = 'view'

    const success = await new Promise((resolve) => {
      img.onerror = () => resolve(false)
      img.onload = () => resolve(true)
    })
    
    if (!success) return success
    
    this.#view.trackBar.detach()
    this.#view.media.abLoop(null)
  
    // replace previous element with new image
    this.#view.shadowRoot.getElementById('view').replaceWith(img)

    img.ondblclick = () => this.#view.signalEvent('view:fullscreen')
    
    return success
  }

  /**
   * Preload and initialize video element events.
   * @param {String} filePath File object.
   * @returns {Promise<Boolean>} Display success.
   */
  async displayVideo(filePath) {
    // preload content, fail gracefully on error
    const vid = document.createElement('video')
    vid.src = filePath
    vid.id = 'view'

    const success = await new Promise((resolve) => {
      vid.onerror = () => resolve(false)
      vid.oncanplay = () => resolve(true)
    })
    
    if (!success) return success
    
    // replace previous element with new video
    this.#view.shadowRoot.getElementById('view').replaceWith(vid)

    // obey autoplay property but toggle on for next videos (for restoring videos as paused)
    if (this.#view.autoplay) this.#view.media.playToggle(true)
    this.#view.autoplay = true

    // attach track monitor and recall runtime state
    this.#view.trackBar.attach(vid)
    this.#view.media.setVolume(this.#view.volume * 100)
    this.#view.media.muteToggle(this.#view.mute)
    this.#view.media.onEndRepeat(this.#view.onEnd)
    this.#view.media.abLoop(null)

    // set methods
    vid.oncanplay = null // null event as video seek also triggers it
    vid.onmousemove = () => this.#view.trackBar.peek()
    vid.oncontextmenu = () => this.#view.media.playToggle()
    vid.ontimeupdate = () => this.#view.trackBar.updateTrack() // not 1:1, lazy but ok
    vid.ondblclick = () => this.#view.signalEvent('view:fullscreen')
  
    // enforce AB loop or signal end-of-track behavior
    vid.onended = () => {
      if (this.#view.aLoop < Infinity) vid.currentTime = this.#view.aLoop
      else this.#view.signalEvent(`view:${this.#view.onEnd}`)
    }

    return success
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