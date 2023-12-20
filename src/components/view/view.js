import { ScrollBox } from "./scrollBox.js"
import { ViewScreen } from "./screen.js"
import { TrackBar } from "./trackBar.js"
import { ViewMedia } from "./media.js"
import { Slideshow } from "./slideshow.js"
import { AppNotifier } from "../../app/notifier.js"


/**
 * Composed multimedia viewer component.
 */
export class View extends HTMLElement {

  static tagName = 'view-component'

  constructor() {
    super()

    /** Currently loaded file type. @type {'image'|'video'} */
    this.fileType = 'image'

    // image
    this.zoom = 100
    this.mode = 'scale'

    // audio / video
    this.volume = 1
    this.mute = true
    this.onEnd = 'loop'
    this.autoplay = true
    this.aLoop = Infinity
    this.bLoop = Infinity
  }

  connectedCallback() {
    // clone template content into shadow root
    const fragment = document.getElementById('viewTemplate').content
    this.attachShadow({ mode: 'open' })
    this.shadowRoot.append(fragment.cloneNode(true))

    // instatiate composed parts
    this.scrollBox = new ScrollBox(this)
    this.screen = new ViewScreen(this)
    this.media = new ViewMedia(this)
    this.trackBar = new TrackBar(this)
    this.slideshow = new Slideshow(this)
  }

  // prevent ghost intervals after DOM removal
  disconnectedCallback() {
    this.slideshow.toggle(false, false)
    this.media.abLoop(null)
  }

  /**
   * Display multimedia file. Show logo if `filePath` is `null`.
   * @param {String} filePath Media resource path.
   * @param {'image'|'video'} type Media type.
   * @returns {Promise<Boolean>} Either display content has changed. 
   */
  async display(filePath, type) {

    if (filePath == null) {
      this.screen.displayEmpty()

      this.signalEvent('view:playing', false)
      this.signalEvent('view:loaded')
      return true
    }
    
    // assign file type, infer if null, fail if unsupported
    if (!type) type = View.inferType(filePath)
    if (type === 'other' ) return false
    this.fileType = type

    // store scroll position, display media by type
    const scroll = this.scrollBox.pos
    const success = type === 'image' ? await this.screen.displayImage(filePath) : 
    await this.screen.displayVideo(filePath)

    // preserve scroll pos & presentation. Emit signals
    if (success) {
      this.scrollBox.pos = { x: scroll.x, y: scroll.y, behavior: 'auto' }
      this.screen.postPass() // re-apply view mode to new content
      this.slideshow.tick()

      const playing = type === 'image' ? this.slideshow.active : !this.media.vid.paused
      this.signalEvent('view:playing', playing)
      this.signalEvent('view:loaded')
    }
    
    return success
  }

  /**
   * Display message on screen.
   * @param {String} msg Message to display.
   * @param {String?} typeId Identifier avoid duplicates.
   */
  osdMsg(msg, typeId) {
    // TODO: transform all call to this into custom events?
    return AppNotifier.notify(msg, typeId)
  }

  /**
   * Auto-scroll to end or start of display
   */
  scrollToEnd(end = true) {
    end = end ? 1 : 0
    this.scrollBox.pos = { x: end, y: end }
  }

  /**
   * Toggle smooth scroll animation when setting scroll position.
   * @param {Boolean} value 
   */
  toggleAutoScrollAnimation(value) {
    if (value === undefined) value = !this.scrollBox.smooth
    this.scrollBox.setAutoScrollAnimation(value)
  }

  /**
   * Navigate view display depending of media and state.
   * First slides scroll bar if any and handle not at border. Next seeks video track. 
   * Last, triggers a `view:next/previous` event. If delta is zero, ends slide interval.
   * @param {'x' | 'y'} axis Either to navigate horizontally or vertically
   * @param {Number} deltaPxls Pixels to move, either positive or negative.
   * @param {Number} deltaSecs Seconds to skip, either positive or negative.
   */
  navigate(axis, deltaPxls, deltaSecs = 0) {

    // null deltaPxls, cancel slide
    if (deltaPxls === 0) {
      this.scrollBox.slide(axis, 0)

      // try to seek if given a number
      if (deltaSecs !== 0) this.media.skipBy(deltaSecs)

      return
    }

    // horizontal
    if (axis == 'x') {
      const xAdds = deltaPxls > 0, scrollPosX = this.scrollBox.pos.x
      const cantFurtherX = xAdds && scrollPosX == 1 || !xAdds && scrollPosX == 0 || scrollPosX == null

      if (!cantFurtherX) this.scrollBox.slide('x', deltaPxls)
      else if (this.fileType == 'video') {
        if (deltaSecs) this.media.skipBy(deltaSecs)
      } else {
        // can't slide and isn't video, skip page
        if (xAdds) this.signalEvent('view:next')
        else this.signalEvent('view:previous')
      }
    }

    // vertical (cantFurtherY modified to let Y > 0 = UP)
    if (axis == 'y') {
      const yAdds = deltaPxls > 0, scrollPosY = this.scrollBox.pos.y
      const cantFurtherY = yAdds && scrollPosY == 0 || !yAdds && scrollPosY == 1 || scrollPosY == null

      if (!cantFurtherY) this.scrollBox.slide('y', deltaPxls * -1)
      else if (deltaSecs) this.media.skipBy(deltaSecs)
    }
  }


  /**
   * Returns state object. Loads state object if given as parameter.
   * @param {StateObject<{}>} stateObject Component properties object.
   * @returns {StateObject<{}>|void}
   */
  state(stateObject) {

    // return current state properties
    if (stateObject === undefined) return {
      // image
      zoom: this.zoom,
      mode: this.mode,

      // audio / video
      volume: this.volume,
      mute: this.mute,
      onEnd: this.onEnd,
      autoplay: this.autoplay,
      aLoop: this.aLoop,
      bLoop: this.bLoop,
    }

    // else, load given state

    // image
    this.zoom = stateObject.zoom
    this.mode = stateObject.mode

    // audio / video
    this.volume = stateObject.volume
    this.mute = stateObject.mute
    this.onEnd = stateObject.onEnd
    this.autoplay = stateObject.autoplay
    this.aLoop = stateObject.aLoop
    this.bLoop = stateObject.bLoop
  }

  /**
   * Infer file type based on extention. Unused, but just in case.
   * @param {String} path 
   */
  static inferType(path) {

    // regex: /\.\w+$/i | however, avoiding it because slow? 
    let ext = '', arr = path.split('.')
    if (arr.length > 1) ext = `.${arr[arr.length -1]}`
    else return 'other'

    switch (ext) {
      case '.jpg': case '.jpeg': case '.png':
      case '.gif': case '.apng': case '.webp': case '.svg':
        return 'image';
      case '.mp4': case '.webm':
      case '.mp3': case '.ogg': // lump together for now
        return 'video';
    }
    return 'other';
  }

  /**
   * Dispatch view event.
   * @param {'view:loaded'|'view:next'|'view:previous'|
   * 'view:playing'|'view:mode'|'view:zoom'|'view:fullscreen'} event
   * @param {*?} detailValue
   */
  signalEvent(event, detailValue) {
    const signal = new CustomEvent(event,  {composed: true, bubbles: true, detail: detailValue})
    this.dispatchEvent(signal)
  }
}

customElements.define(View.tagName, View)