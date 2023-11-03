/** Scrollbar methods for Viewer content container. */
export class ScrollBox {

  /** Parent View component.
   * @type {import('./view.js').View} */
  #view

  /** ScrollBox root HTML Div element contained in View.
   * @type {HTMLDivElement} */
  #box

  /** Instant smooth scroll interval loop.
   * @type {Number?} */
  #slideInterval = null

  /** Horizontal delta to be applied each slide loop tick */
  #deltaX = 0

  /** Vertical delta to be applied each slide loop tick */
  #deltaY = 0

  /** Timeout, hides mouse cursor after inactive for a set amount.
   * @type {Number?} */
  #cursorHideTimer

  /**
   * Composed element scroll controller.
   * @param {import('./view.js').View} view View instance.
   */
  constructor(view) {
    this.#view = view
    this.#box = view.shadowRoot.getElementById('scrollBox');
    this.smooth = true;

    this.#initEvents()
  }

  setAutoScrollAnimation(active) {
    this.smooth = active;
    this.#view.osdMsg(`auto-scroll animation ${this.smooth ? 'on' : 'off'}`);
  }

  /** Either view has horizontal scrollbar */
  get hasX() {
    return this.#box.scrollWidth > this.#box.clientWidth;
  }

  /** Either view has vertical scrollbar */
  get hasY() {
    return this.#box.scrollHeight > this.#box.clientHeight;
  }

  /**
   * Set or get normalized scroll position. 0 = left/top; 1 = right/bottom.
   * @return {{x?:Number, y?:Number}} vector
   */
  get pos() {
    let x = undefined, y = undefined;
    // if scrollbar, calculate normalized position 
    if (this.hasX) {
      // F(x) = pixels occluded / (pixels total - pixels shown)
      x = this.#box.scrollLeft / (this.#box.scrollWidth - this.#box.clientWidth)
    }
    if (this.hasY) {
      y = this.#box.scrollTop / (this.#box.scrollHeight - this.#box.clientHeight);
    }
    return { x: x, y: y };
  }

  /**
   * Set or get normalized scroll position. 0 = left/top; 1 = right/bottom.
   * @param {{x?:Number, y?:Number, behavior?:'auto'|'smooth'}} vector
   */
  set pos(vector) {
    let x = this.#box.scrollLeft, y = this.#box.scrollTop;
    // if axis not null or undefined, set normalized position
    if (vector.x != null) {
      // F(x) = 0~1 * pixels total - pixels shown
      x = vector.x * (this.#box.scrollWidth - this.#box.clientWidth);
    }
    if (vector.y != null) {
      y = vector.y * (this.#box.scrollHeight - this.#box.clientHeight);
    }
    // smooth scroll, else snap
    this.#box.scroll({
      top: y, left: x, 
      behavior: vector.behavior || (this.smooth ? 'smooth' : 'auto')
    });
  }

  /**
   * Slides scroll alongside axis in intervals smoothly and instantaneously.
   * @param {'x'|'y'} axis Axis to slide.
   * @param {Number} value Delta, zero cancels axis.
   */
  slide(axis, value) {
    // update deltas. If interval exists, early exit
    axis === 'x' ? this.#deltaX = value : this.#deltaY = value
    if (this.#slideInterval) return

    this.#slideInterval = setInterval(() => {
      // zero value if axis isn't zero but can't scroll further
      const xAdds = this.#deltaX > 0
      const cantFurtherX = xAdds && this.pos.x === 1 || !xAdds && this.pos.x === 0
      if (cantFurtherX) this.#deltaX = 0

      const yAdds = this.#deltaY > 0
      const cantFurtherY = !yAdds && this.pos.y === 0 || yAdds && this.pos.y === 1
      if (cantFurtherY) this.#deltaY = 0

      // end loop if both axis are zero
      if (this.#deltaX === 0 && this.#deltaY === 0) {
        clearInterval(this.#slideInterval)
        this.#slideInterval = null
        return
      }

      this.#box.scrollLeft += this.#deltaX
      this.#box.scrollTop += this.#deltaY
    }, 10) // too low and cpu usage rises
  }

  #resetCursorHideTimer() {
    clearTimeout(this.#cursorHideTimer)
    this.#cursorHideTimer = setTimeout(() => {
      this.#box.style.cursor = 'none'
    }, 1000)
  }

  // cursor auto-hide and drag
  #initEvents() {
    
    // cursor hide timer and scrollbar mouse drag
    this.#box.onmousemove = (e) => {
      // drag when there are scrollbars
      const hasScrBar = this.hasX || this.hasY
      this.#box.style.cursor = hasScrBar ? 'grab' : 'default'
      // no dragging conditions, reset timer while exiting
      if (!hasScrBar || e.buttons != 1) return this.#resetCursorHideTimer()
      // else
      this.#box.style.cursor = 'grabbing'
      this.#box.scrollBy(-e.movementX, -e.movementY)
    }

    // change cursor on grab
    this.#box.onmousedown = (e) => {
      const cursor = this.hasX || this.hasY ? 'grabbing' : 'default'
      this.#box.style.cursor = cursor
      if (cursor == 'grabbing') clearTimeout(this.#cursorHideTimer)
    }

    // change cursor on grab release
    this.#box.onmouseup = (e) => {
      const cursor = this.hasX || this.hasY ? 'grab' : 'default'
      this.#box.style.cursor = cursor
      this.#resetCursorHideTimer()
    }

    // reveal cursor
    this.#box.onmouseleave = () => {
      this.#box.style.cursor = 'default'
      clearTimeout(this.#cursorHideTimer)
    }

    // wheel zoom, seek track
    this.#box.addEventListener('wheel', (e) => {
      // zoom in/out when holding shift
      if (e.shiftKey) {
        e.preventDefault()
        this.#view.imgView.zoom(e.deltaY > 0 ? '-10 ': '+10')
        return
      }
    
      // handle scroll natively
      if (this.hasX || this.hasY) return
      // else, seek video or request next image
      if (this.#view.fileType != 'image') {
        this.#view.vidView.skipBy(`${Math.sign(e.deltaY) * -2}%`) // relative
      } else {
        if (e.deltaY > 0) this.#view.signalEvent('view:next')
        else this.#view.signalEvent('view:previous')
      }
    }, {passive: false})
  }
};
