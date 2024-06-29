/**
 * @typedef {'cycle'|'loop'|'skip'|'random'} OnTrackEndModes
 */


/** 
 * View audio/video track methods (audio/video). 
 */
export class ViewMedia {

  /**
   * Host View component.
   * @type {import('./view.js').View}
   */
  #view

  /**
   * @param {import('./view.js').View} view View instance.
   */
  constructor(view) {
    this.#view = view
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
   * @param {Boolean} [force] Force play on `true`, pause on `false`.
   */
  playToggle(force) {
    const vid = this.vid
    if (!vid) return

    if (force !== undefined) force ? vid.play() : vid.pause()
    else vid.paused ? vid.play() : vid.pause()
    this.#view.trackBar.peek()

    // also toggle interval 
    if (this.#view.aLoop != Infinity && this.#view.bLoop != Infinity) {
      this.#abLoopInterval(!vid.paused)
    }

    this.#view.events.fire('view:playing', !vid.paused)
  }
  
  /**
   * Toggle media mute.
   * @param {Boolean} [force] Either to force mute on or off.
   */
  muteToggle(force) {
    const vid = this.vid
    if (!vid) return
  
    if (force !== undefined) vid.muted = force
    else vid.muted = !vid.muted
  
    this.#view.mute = vid.muted
    this.#view.trackBar.peek()
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
    this.#view.trackBar.peek()
  }
  
  /**
   * Set flow behavior on end of track. Cycle through modes by default.
   * @param {OnTrackEndModes} [behavior] What to do on end of track.
   */
  onEndRepeat(behavior = 'cycle') {
    const vid = this.vid
    if (!vid) return

    // no arg given or invalid, cycle and notify 
    const modes = ['loop', 'skip', 'random']
    const invalid = modes.indexOf(behavior) < 0
    if (behavior == null || invalid) {
      behavior = modes[ (modes.indexOf(this.#view.onEnd) + 1) % 3 ]
      this.#view.events.fire('view:notify', `on track end: ${behavior}`, 'loopFile')
    }

    vid.loop = behavior === 'loop'
    this.#view.onEnd = behavior
    this.#view.trackBar.peek()
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
    this.#view.trackBar.updateTrack()
    this.#view.trackBar.peek()
  }
  
  /**
   * Set video playback speed or increment/decrement with +/-.
   * @param {Number|String} value Playback speed to set.
   */
  playbackRate(value) {
    const vid = this.vid
    if (!vid) return

    let valueNumber = parseFloat(value)
    if ( isNaN(valueNumber) ) valueNumber = 1

    const signed = String(value)[0] == '+' || String(value)[0] == '-'
    value = signed ? vid.playbackRate + valueNumber : valueNumber

    vid.playbackRate = Math.min( Math.max(value, .25), 16 )

    const fixedRate = vid.playbackRate.toFixed(2)
    this.#view.events.fire('view:notify', `playback rate set to ${fixedRate}`, 'playbackRate')
  }

  /**
   * Set audio pitch-correction behavior at modified playback rates.
   * @param {Boolean} [preserve] Toggle behavior by default.
   */
  preservePitch(preserve) {
    const vid = this.vid
    if (!vid) return

    if ( preserve == null ) vid.preservesPitch = !vid.preservesPitch
    else vid.preservesPitch = preserve

    this.#view.events.fire('view:notify', `preservePitch: ${vid.preservesPitch}`, 'prePitch')
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
   * @param {Number|undefined|null} [customTime] Custom video time in secs.
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
      this.#view.events.fire('view:notify', `A loop on ${this.secToHMS(tgtTime)}`)
      return
    }

    // set B
    if (this.#view.bLoop == Infinity) {
      // invalid, clear loop
      if (tgtTime <= this.#view.aLoop) {
        this.abLoop(null)
        this.#view.events.fire('view:notify', `B loop before A, clear`)
        return
      }

      this.#view.bLoop = tgtTime
      this.#view.events.fire('view:notify', `B loop on ${this.secToHMS(tgtTime)}`)
      if (!vid.paused) this.#abLoopInterval()
      return
    }

    // clear loop
    this.abLoop(null)
    this.#view.events.fire('view:notify', 'AB loop clear')
  }

  /**
   * Start or clear A-B loop interval.
   * @param {boolean} [start=true] Either to start interval. Clear if false.
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