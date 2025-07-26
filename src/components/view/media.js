// @ts-check

/**
 * @typedef {'loop'|'skip'|'random'} OnTrackEndMode
 */


/** 
 * View audio/video track methods (audio/video). 
 */
export class ViewMedia {

  /**
   * Host View component.
   * @type {import('./view.js').View}
   */
  #view;

  /**
   * A-B loop interval timer.
   * @type {NodeJS.Timeout|undefined}
   */
  #abLoopTimer;

  /**
   * @param {import('./view.js').View} view View instance.
   */
  constructor(view) {
    this.#view = view;
  }

  /**
   * View video element. Null otherwise. 
   * - References gets lost as object is replaced every `display()`. 
   * This re-captures it every call.
   * @returns {HTMLVideoElement?}
   */
  get vid() {
    const shadowRoot = /** @type ShadowRoot */ (this.#view.shadowRoot);
    const element = /** @type {HTMLImageElement|HTMLVideoElement} */ 
      (shadowRoot.getElementById('view'));

    return element.tagName === 'VIDEO'
      ? /** @type {HTMLVideoElement} */ (element)
      : null;
  }
  
  /**
   * Toggle play state.
   * @param {boolean} [force] Force play on `true`, pause on `false`.
   */
  playToggle(force) {
    const vid = this.vid;
    if (!vid)
      return;

    if (force !== undefined)
      force ? vid.play() : vid.pause();
    else
      vid.paused ? vid.play() : vid.pause();

    this.#view.trackBar.peek();

    // also toggle interval 
    if (this.#view.aLoop != Infinity && this.#view.bLoop != Infinity)
      this.#abLoopInterval(!vid.paused);

    this.#view.events.fire('view:playing', !vid.paused);
  }
  
  /**
   * Toggle media mute.
   * @param {boolean} [force] Either to force mute on or off.
   */
  muteToggle(force) {
    const vid = this.vid;
    if (!vid)
      return;
  
    vid.muted = force === undefined
      ? !vid.muted
      : force;
  
    this.#view.mute = vid.muted;
    this.#view.trackBar.peek();
  }
  
  /**
   * Set volume or increment/decrement with +/-.
   * @param {string|number} volume 
   */
  setVolume(volume) {
    const vid = this.vid;
    if (!vid)
      return;
  
    // detect signs for incremental/decremental volume
    const volumeString = String(volume);
    const value = parseFloat(volumeString);

    if ( isNaN(value) )
      return;

    // normalize and clamp volume
    const relative = volumeString[0] === '+' || volumeString[0] === '-';
    let newVol = relative ? vid.volume + (value / 100) : value / 100;
    newVol = Math.min( 1, Math.max(0, newVol) );

    vid.volume = newVol;
    this.#view.volume = vid.volume;
    this.#view.trackBar.peek();
  }
  
  /**
   * Set flow behavior on end of track. Cycle through modes by default.
   * @param {OnTrackEndMode} [behavior] What to do on end of track.
   */
  onEndRepeat(behavior) {
    const vid = this.vid;
    if (!vid)
      return;

    const modes = /** @type OnTrackEndMode[] */ (['loop', 'skip', 'random']);

    // if no arg given or invalid, cycle and notify 
    if ( behavior == null || !modes.includes(behavior) ) {
      behavior = modes[ (modes.indexOf(this.#view.onEnd) + 1) % 3 ];
      this.#view.events.fire('view:notify', `on track end: ${behavior}`, 'loopFile');
    }

    vid.loop = behavior === 'loop';
    this.#view.onEnd = behavior;
    this.#view.trackBar.peek();
  }
  
  /**
   * Skip video position in seconds. `10%` skips the video by 10% of total duration.
   * @param {number|string} value By how much to skip video in secs.
   */
  skipBy(value) {
    const vid = this.vid;
    if (!vid)
      return;

    const fetchString = String(value);
    const newValue = parseFloat(fetchString);

    if ( isNaN(newValue) )
      return;

    vid.currentTime += fetchString.includes('%')
      ? vid.duration * (newValue * .01) // relative to track duration
      : newValue;

    this.#view.trackBar.peek();
  }
  
  /**
   * Set video playback speed or increment/decrement with +/-.
   * @param {number|string} value Playback speed to set.
   */
  playbackRate(value) {
    const vid = this.vid;
    if (!vid)
      return;

    const rateString = String(value);
    let valueNumber = parseFloat(rateString);

    if ( isNaN(valueNumber) )
      valueNumber = 1; // reset if invalid

    value = rateString[0] === '+' || rateString[0] === '-'
      ? vid.playbackRate + valueNumber // relative
      : valueNumber;

    vid.playbackRate = Math.min( Math.max(value, .25), 16 );

    const fixedRate = vid.playbackRate.toFixed(2);
    this.#view.events.fire('view:notify', `playback rate set to ${fixedRate}`, 'playbackRate');
    this.#view.trackBar.peek();
  }

  /**
   * Set audio pitch-correction behavior at modified playback rates.
   * @param {boolean} [preserve] Toggle behavior by default.
   */
  preservePitch(preserve) {
    const vid = this.vid;
    if (!vid)
      return;

    vid.preservesPitch = preserve == null
      ? !vid.preservesPitch
      : preserve;

    this.#view.events.fire('view:notify', `preservePitch: ${vid.preservesPitch}`, 'prePitch');
    this.#view.trackBar.peek();
  }
  
  /**
   * Get HH:MM:SS string from seconds.
   * @param {number} seconds 
   * @returns {string} Formated time string.
   */
  secToHMS(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor(seconds % 3600 / 60);
    const s = Math.floor(seconds % 3600 % 60);

    const H = h ? String(h).padStart(2, '0') : '00';
    const M = m ? String(m).padStart(2, '0') : '00';
    const S = s ? String(s).padStart(2, '0') : '00';

    return `${H}:${M}:${S}`;
  }

  /**
   * Set A loop, B loop on current time. Clear loop if A and B already set or null is passed.
   * @param {number|undefined|null} [customTime] Custom video time in secs.
   */
  abLoop(customTime) {
    // reset exactly on null
    if (customTime === null) {
      this.#view.aLoop = Infinity;
      this.#view.bLoop = Infinity;
      this.#abLoopInterval(false);
      return;
    }

    const vid = this.vid;
    if (!vid)
      return;

    const tgtTime = customTime ?? vid.currentTime;

    // set A
    if (this.#view.aLoop == Infinity) {
      this.#view.aLoop = tgtTime;
      this.#view.events.fire('view:notify', `A loop at ${this.secToHMS(tgtTime)}`, 'abLoop');
    }
    // set B
    else if (this.#view.bLoop == Infinity) {
      if (tgtTime > this.#view.aLoop) {
        this.#view.bLoop = tgtTime;
        !vid.paused && this.#abLoopInterval();
        this.#view.events.fire('view:notify', `B loop at ${this.secToHMS(tgtTime)}`, 'abLoop');
      } else {
        this.abLoop(null);
        this.#view.events.fire('view:notify', 'B loop before A, clear', 'abLoop');
      }
    }
    // clear loop
    else {
      this.abLoop(null);
      this.#view.events.fire('view:notify', 'AB loop clear', 'abLoop');
    }

    this.#view.trackBar.peek();
  }

  /**
   * Start or clear A-B loop interval.
   * @param {boolean} [start=true] Either to start interval. Clear if false.
   */
  #abLoopInterval(start = true) {
    if (!start)
      return clearInterval(this.#abLoopTimer);

    const vid = this.vid;
    if (!vid)
      return;

    // best effort to enforce ABloop on time
    this.#abLoopTimer = setInterval(() => {
      if (vid.currentTime + .010 >= this.#view.bLoop)
        vid.currentTime = this.#view.aLoop;
    }, 10);
  }
}
