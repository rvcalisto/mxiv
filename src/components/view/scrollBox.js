// @ts-check

/** 
 * Scrollbar methods for Viewer content container. 
 */
export class ScrollBox {

  /**
   * Host View component.
   * @type {import('./view.js').View}
   */
  #view;

  /**
   * ScrollBox root HTML Div element contained in View.
   * @type {HTMLDivElement}
   */
  #box;

  /** 
   * Instant smooth scroll interval loop.
   * @type {NodeJS.Timeout|undefined}
   */
  #slideInterval;

  /**
   * Horizontal delta to be applied each slide loop tick.
   */
  #deltaX = 0;

  /**
   * Vertical delta to be applied each slide loop tick.
   */
  #deltaY = 0;

  /**
   * Timeout, hides mouse cursor after inactive for a set amount.
   * @type {NodeJS.Timeout|undefined}
   */
  #cursorHideTimer;

  /**
   * @param {import('./view.js').View} view View instance.
   */
  constructor(view) {
    this.#view = view;
    const shadowRoot = /** @type {ShadowRoot} */ (view.shadowRoot);
    this.#box = /** @type {HTMLDivElement} */ (shadowRoot.getElementById('scrollBox'));
    this.smooth = true;

    this.#initEvents();
  }

  /**
   * Enable/disable scroll animation.
   * @param {boolean} active
   */
  setAutoScrollAnimation(active) {
    this.smooth = active;
    this.#view.events.fire('view:notify', `auto-scroll animation ${this.smooth ? 'on' : 'off'}`);
  }

  /**
   * Either view has horizontal scrollbar.
   */
  get hasX() {
    return this.#box.scrollWidth > this.#box.clientWidth;
  }

  /**
   * Either view has vertical scrollbar.
   */
  get hasY() {
    return this.#box.scrollHeight > this.#box.clientHeight;
  }

  /**
   * Set or get normalized scroll position. 0 = left/top; 1 = right/bottom.
   * @return {{x?:number, y?:number}} vector
   */
  get pos() {
    let x = undefined, y = undefined;

    // F(x) = pixels occluded / (pixels total - pixels shown)
    if (this.hasX)
      x = this.#box.scrollLeft / (this.#box.scrollWidth - this.#box.clientWidth);

    if (this.hasY)
      y = this.#box.scrollTop / (this.#box.scrollHeight - this.#box.clientHeight);

    return { x: x, y: y };
  }

  /**
   * Set or get normalized scroll position. 0 = left/top; 1 = right/bottom.
   * @param {{x?:number, y?:number, behavior?:'auto'|'smooth'}} vector
   */
  set pos(vector) {
    let x = this.#box.scrollLeft, y = this.#box.scrollTop;

    // F(x) = 0~1 * pixels total - pixels shown
    if (vector.x != null)
      x = vector.x * (this.#box.scrollWidth - this.#box.clientWidth);

    if (vector.y != null)
      y = vector.y * (this.#box.scrollHeight - this.#box.clientHeight);

    // smooth scroll, else snap
    this.#box.scroll({
      top: y, left: x, 
      behavior: vector.behavior || (this.smooth ? 'smooth' : 'auto')
    });
  }

  /**
   * Slides scroll alongside axis in intervals smoothly and instantaneously.
   * @param {'x'|'y'} axis Axis to slide.
   * @param {number} value Delta, zero cancels axis.
   */
  slide(axis, value) {
    // update deltas, guard against interval overwrites
    axis === 'x' ? this.#deltaX = value : this.#deltaY = value;

    if (this.#slideInterval != null)
      return;

    this.#slideInterval = setInterval(() => {
      // zero value if axis isn't zero but can't scroll further
      const xAdds = this.#deltaX > 0;
      const cantFurtherX = xAdds && this.pos.x === 1 || !xAdds && this.pos.x === 0;

      if (cantFurtherX)
        this.#deltaX = 0;

      const yAdds = this.#deltaY > 0;
      const cantFurtherY = !yAdds && this.pos.y === 0 || yAdds && this.pos.y === 1;

      if (cantFurtherY)
        this.#deltaY = 0;

      // end loop if both axis are zero
      if (this.#deltaX === 0 && this.#deltaY === 0) {
        clearInterval(this.#slideInterval);
        this.#slideInterval = undefined;
        return;
      }

      this.#box.scrollLeft += this.#deltaX;
      this.#box.scrollTop += this.#deltaY;
    }, 10); // too low and cpu usage rises
  }

  #resetCursorHideTimer() {
    clearTimeout(this.#cursorHideTimer);

    this.#cursorHideTimer = setTimeout(() => {
      this.#box.style.cursor = 'none';
    }, 1000);
  }

  // cursor auto-hide and drag
  #initEvents() {
    
    // cursor hide timer and scrollbar mouse drag
    this.#box.onmousemove = (e) => {
      // drag when there are scrollbars
      const hasScrBar = this.hasX || this.hasY;
      this.#box.style.cursor = hasScrBar ? 'grab' : 'default';

      // no dragging conditions, reset timer while exiting
      if (!hasScrBar || e.buttons != 1)
        return this.#resetCursorHideTimer();

      // else
      this.#box.style.cursor = 'grabbing';
      this.#box.scrollBy(-e.movementX, -e.movementY);
    };

    // change cursor on grab
    this.#box.onmousedown = (_) => {
      const cursor = this.hasX || this.hasY ? 'grabbing' : 'default';
      this.#box.style.cursor = cursor;

      if (cursor == 'grabbing')
        clearTimeout(this.#cursorHideTimer);
    };

    // change cursor on grab release
    this.#box.onmouseup = (_) => {
      const cursor = this.hasX || this.hasY ? 'grab' : 'default';
      this.#box.style.cursor = cursor;
      this.#resetCursorHideTimer();
    };

    // reveal cursor
    this.#box.onmouseleave = () => {
      this.#box.style.cursor = 'default';
      clearTimeout(this.#cursorHideTimer);
    };

    // wheel zoom, seek track
    this.#box.addEventListener('wheel', (e) => {
      // zoom in/out when holding shift
      if (e.shiftKey) {
        e.preventDefault();
        this.#view.screen.zoom(e.deltaY > 0 ? '-10 ': '+10');
        return;
      }

      // no scrollbar, seek video or request next image
      if (!this.hasX && !this.hasY) {
        if (this.#view.fileType != 'image')
          this.#view.media.skipBy(`${Math.sign(e.deltaY) * -2}%`); // relative
        else
          this.#view.events.fire('view:skip', e.deltaY > 0);
      }

    }, { passive: false });
  }
}
