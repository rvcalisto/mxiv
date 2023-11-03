import { TrackBar } from "./trackBar.js"

/** View methods for video content. */
export class VideoView {

  /** Parent View component.
   * @type {import('./view.js').View} */
  #view

  /**
   * Composed audio/video element class.
   * @param {import('./view.js').View} view View instance.
   */
  constructor(view) {
    this.#view = view
    this.trackBar = new TrackBar(view)
  }

  /**
   * Preload and initialize video element events.
   * @param {String} filePath File object.
   * @returns {Promise<Boolean>} Display success.
   */
  async display(filePath) {

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
    if (this.#view.autoplay) this.playToggle(true)
    this.#view.autoplay = true

    // attach track monitor and recall runtime state
    this.trackBar.attach(vid)
    this.setVolume(this.#view.volume * 100)
    this.muteToggle(this.#view.mute)
    this.onEndRepeat(this.#view.onEnd)
    this.abLoop(null)

    // set methods
    vid.oncanplay = null // null event as video seek also triggers it
    vid.onmousemove = () => this.trackBar.peek()
    vid.oncontextmenu = () => this.playToggle()
    vid.ontimeupdate = () => this.trackBar.updateTrack() // not 1:1, lazy but ok
    vid.ondblclick = () => this.#view.signalEvent('view:fullscreen')
  
    // enforce AB loop or signal end-of-track behavior
    vid.onended = () => {
      if (this.#view.aLoop < Infinity) vid.currentTime = this.#view.aLoop
      else this.#view.signalEvent(`view:${this.#view.onEnd}`)
    }

    return success
  }

  /**
   * View video element. Null otherwise. 
   * - References gets lost as object is replaced every `display()`. 
   * This re-captures it every call.
   * @returns {HTMLVideoElement?}
   */
  get vid() {
    const videoElement = this.#view.shadowRoot.getElementById('view')
    return videoElement.tagName === 'VIDEO' ? videoElement : null
  }
  
  /**
   * Toggle play state.
   * @param {Boolean?} force Force play on `true`, pause on `false`.
   */
  playToggle(force) {
    const vid = this.vid
    if (!vid) return

    if (force !== undefined) force ? vid.play() : vid.pause()
    else vid.paused ? vid.play() : vid.pause()
    this.trackBar.peek()

    // also toggle interval 
    if (this.#view.aLoop != Infinity && this.#view.bLoop != Infinity) {
      this.#abLoopInterval(!vid.paused)
    }

    this.#view.signalEvent('view:playing', !vid.paused)
  }
  
  /**
   * Toggle media mute.
   * @param {Boolean?} force Either to force mute on or off.
   */
  muteToggle(force) {
    const vid = this.vid
    if (!vid) return
  
    if (force !== undefined) vid.muted = force
    else vid.muted = !vid.muted
  
    this.#view.mute = vid.muted
    this.trackBar.peek()
  }
  
  /**
   * Set volume or increment/decrement with +/-.
   * @param {String|Number} volume 
   */
  setVolume(volume) {
    const vid = this.vid
    if (!vid) return
  
    // detect signs for incremental/decremental volume
    const add = String(volume)[0] == '+' || String(volume)[0] == '-'
    const value = parseFloat(volume)

    if (isNaN(value)) return
    
    // normalize and clamp volume
    let newVol = add ? vid.volume + (value / 100) : value / 100
    newVol = Math.min(1, Math.max(0, newVol))
  
    vid.volume = newVol
    this.#view.volume = vid.volume
    this.trackBar.peek()
  }
  
  /**
   * Set flow behavior on end of track. Cycle through modes by default.
   * @param {'cycle'|'loop'|'next'|'random'} behavior What to do on end of track.
   */
  onEndRepeat(behavior = 'cycle') {
    const vid = this.vid
    if (!vid) return

    // no arg given or invalid, cycle and notify 
    const modes = ['loop', 'next', 'random']
    const invalid = modes.indexOf(behavior) < 0
    if (behavior == null || invalid) {
      behavior = modes[ (modes.indexOf(this.#view.onEnd) + 1) % 3 ]
      this.#view.osdMsg(`on track end: ${behavior}`, 'loopFile')
    }

    vid.loop = behavior === 'loop'
    this.#view.onEnd = behavior
    this.trackBar.peek()
  }
  
  /**
   * Skip video position in seconds. `10%` skips the video by 10% of total duration.
   * @param {Number|String} value By how much to skip video in secs.
   */
  skipBy(value) {
    const vid = this.vid
    if (!vid) return

    // relative or raw seconds
    if (String(value).includes('%')) {
      const percent = vid.duration * (parseFloat(value) * .01); 
      vid.currentTime += percent
    } else {
      vid.currentTime += value
    }
    this.trackBar.updateTrack()
    this.trackBar.peek()
  }
  
  /**
   * Changes video playback speed.
   * @param {Number} value Playback speed to set.
   */
  playbackRate(value) {
    const vid = this.vid
    if (!vid) return

    vid.playbackRate = Math.min(Math.max(value, .07), 16)
    this.#view.osdMsg(`playback rate set to ${vid.playbackRate}`)
  }
  
  /**
   * Get HH:MM:SS string from seconds.
   * @param {Number} seconds 
   * @returns {String} Formated time string.
   */
  secToHMS(seconds) {
    let h = Math.floor(seconds / 3600)
    let m = Math.floor(seconds % 3600 / 60)
    let s = Math.floor(seconds % 3600 % 60)
    // let ms = String(seconds).split('.')[1]
    
    h = h ? String(h).padStart(2, 0) : '00'
    m = m ? String(m).padStart(2, 0) : '00'
    s = s ? String(s).padStart(2, 0) : '00'
    // ms = ms ? ms.substring(0,3) : '000'
  
    return `${h}:${m}:${s}`
  }

  /**
   * Set A loop, B loop on current time. Clear loop if A and B already set or null is passed.
   * @param {Number|undefined|null} customTime Custom video time in secs.
   */
  abLoop(customTime) {
    // reset exactly on null
    if (customTime === null) {
      this.#view.aLoop = Infinity
      this.#view.bLoop = Infinity
      this.#abLoopInterval(false)
      return
    }

    const vid = this.vid
    if (!vid) return
    const tgtTime = customTime ?? vid.currentTime

    // set A
    if (this.#view.aLoop == Infinity) {
      this.#view.aLoop = tgtTime
      this.#view.osdMsg(`A loop on ${this.secToHMS(tgtTime)}`)
      return
    }

    // set B
    if (this.#view.bLoop == Infinity) {
      // invalid, clear loop
      if (tgtTime <= this.#view.aLoop) {
        this.abLoop(null)
        this.#view.osdMsg(`B loop before A, clear`)
        return
      }

      this.#view.bLoop = tgtTime
      this.#view.osdMsg(`B loop on ${this.secToHMS(tgtTime)}`)
      if (!vid.paused) this.#abLoopInterval()
      return
    }

    // clear loop
    this.abLoop(null)
    this.#view.osdMsg('AB loop clear')
  }

  /**
   * Start or clear A-B loop interval.
   * @param {true} start Either to start interval. Clear if false.
   */
  #abLoopInterval(start = true) {
    if (!start) return clearInterval(this.abLoopInterval)

    const vid = this.vid
    if (!vid) return

    // best effort to enforce ABloop on time
    this.abLoopInterval = setInterval(() => {
      if (vid.currentTime + .010 >= this.#view.bLoop) {
        vid.currentTime = this.#view.aLoop
      }
    }, 10);
  }

}
