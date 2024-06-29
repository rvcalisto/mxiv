import { ScrollBox } from "./scrollBox.js"
import { ViewScreen } from "./screen.js"
import { TrackBar } from "./trackBar.js"
import { ViewMedia } from "./media.js"
import { Slideshow } from "./slideshow.js"
import { ObservableEvents } from "../observableEvents.js"


/**
 * @typedef {'view:loaded'|'view:skip'|'view:playing'|'view:notify'|
 * 'view:mode'|'view:zoom'|'view:fullscreen'} ViewEvents
 */

/**
 * @typedef {'image'|'audio'|'video'|'other'} MediaTypes
 */


/**
 * Composed multimedia viewer component.
 */
export class View extends HTMLElement {

  static tagName = 'view-component'

  /** 
   * @type {ObservableEvents<ViewEvents>} 
   */
  events = new ObservableEvents()

  /**
   * Currently loaded file type.
   * @type {MediaTypes}
   */
  fileType = 'image'

  // image
  zoom = 100

  /** @type {import('./screen.js').DisplayModes} */
  mode = 'scale'

  // audio / video
  volume = 1
  mute = true

  /** @type {import('./media.js').OnTrackEndModes} */
  onEnd = 'loop'

  autoplay = true
  aLoop = Infinity
  bLoop = Infinity


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
   * @param {MediaTypes} type Media type.
   * @returns {Promise<Boolean>} Either display content has changed. 
   */
  async display(filePath, type) {
    if (filePath == null) {
      this.screen.displayEmpty()

      this.events.fire('view:playing', false)
      this.events.fire('view:loaded')
      return true
    }
    
    // assign file type, fail if unsupported
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
      this.events.fire('view:playing', playing)
      this.events.fire('view:loaded')
    }
    
    return success
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
   * @param {Boolean} [value] 
   */
  toggleAutoScrollAnimation(value) {
    if (value == null) value = !this.scrollBox.smooth
    this.scrollBox.setAutoScrollAnimation(value)
  }

  /**
   * Start/Stop scrollbar slide interval, flip pages and seek audio/video tracks on context.
   * - Media has scrollbar: Slide scroll by `deltaPxls` in intervals and while not at border.
   * - No scrollbar/sliding against border: Flip images by `deltaPxls` sign, 
   *   skip audio/video by `deltaSecs`.
   * - `deltaPxls` is zero: Clear slide interval, skip audio/video by `deltaSecs`.
   * @param {'x'|'y'} axis Either to navigate horizontally or vertically
   * @param {Number} deltaPxls Pixels to move, either positive or negative.
   * @param {Number} [deltaSecs] Seconds to skip, either positive or negative.
   */
  navigate(axis, deltaPxls, deltaSecs = 0) {

    // cancel slide for axis, skip track if not zero
    if (deltaPxls === 0)
      this.scrollBox.slide(axis, 0)

    // horizontal
    else if (axis === 'x') {
      const xAdds = deltaPxls > 0, scrollPosX = this.scrollBox.pos.x
      const canScrollX = xAdds && scrollPosX < 1 || !xAdds && scrollPosX > 0

      if (canScrollX)
        return this.scrollBox.slide('x', deltaPxls)
      else if (this.fileType === 'image')
        return this.events.fire('view:skip', xAdds) // flip page
    }

    // vertical (canScrollY modified to let deltaPxls(Y) > 0 = UP)
    else if (axis === 'y') {
      const yAdds = deltaPxls > 0, scrollPosY = this.scrollBox.pos.y
      const canScrollY = yAdds && scrollPosY > 0 || !yAdds && scrollPosY < 1

      if (canScrollY)
        return this.scrollBox.slide('y', deltaPxls * -1)
    }

    if (this.fileType !== 'image' && deltaSecs !== 0)
      this.media.skipBy(deltaSecs)
  }

  /**
   * Returns state object. Loads state object if given as parameter.
   * @param {*} [stateObject] Component properties object.
   * @returns {*?}
   */
  state(stateObject) {

    if (stateObject == null) return {
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
}

customElements.define(View.tagName, View)
