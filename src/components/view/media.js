// @ts-check
import { HMStoSec, secToHMS } from './trackUtils.js';

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
  get #vid() {
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
    const vid = this.#vid;
    if (!vid)
      return;

    if (force !== undefined)
      force ? vid.play() : vid.pause();
    else
      vid.paused ? vid.play() : vid.pause();

    this.#view.trackBar.peek();

    // also toggle interval 
    if (this.#view.aLoop != Infinity && this.#view.bLoop != Infinity)
      this.#toggleABloopInterval(!vid.paused);

    this.#view.events.fire('view:playing', !vid.paused);
  }
  
  /**
   * Toggle media mute.
   * @param {boolean} [force] Either to force mute on or off.
   */
  muteToggle(force) {
    const vid = this.#vid;
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
    const vid = this.#vid;
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
    const vid = this.#vid;
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
    const vid = this.#vid;
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
   * Seek track to given time. `10%` seeks to 10% of total duration, 
   * while prefixing +/- applies change to current time.
   * @param {number|string} value Time in seconds, percent or `HH:MM:SS` format.
   */
  seek(value) {
    const vid = this.#vid;
    if (!vid)
      return;

    const seekString = String(value),
          relative = seekString[0] === '+' || seekString[0] === '-',
          sign = seekString[0] === '-' ? -1 : 1;

    const newValue = seekString.includes(':')
      ? HMStoSec(seekString.replace('+', '')
                           .replace('-', '')
                           .replace('%', '')) * sign
      : parseFloat(seekString);

    if ( isNaN(newValue) )
      return;

    const seconds = seekString.includes('%') && !seekString.includes(':')
      ? vid.duration * (newValue * .01) // relative to track duration
      : newValue;

    relative
      ? vid.currentTime += seconds
      : vid.currentTime = seconds;

    this.#view.trackBar.peek();
  }
  
  /**
   * Set video playback speed or increment/decrement with +/-.
   * @param {number|string} value Playback speed to set.
   */
  playbackRate(value) {
    const vid = this.#vid;
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
    const vid = this.#vid;
    if (!vid)
      return;

    vid.preservesPitch = preserve == null
      ? !vid.preservesPitch
      : preserve;

    this.#view.events.fire('view:notify', `preservePitch: ${vid.preservesPitch}`, 'prePitch');
    this.#view.trackBar.peek();
  }

  /**
   * Set AB loop nodes on current time. Clear if both already set or null is passed.
   * @param {string?} [customA] Custom A loop HH:MM:SS time.
   * @param {string} [customB] Custom B loop HH:MM:SS time.
   */
  abLoop(customA, customB) {

    // reset exactly on null
    if (customA === null) {
      this.#view.aLoop = Infinity;
      this.#view.bLoop = Infinity;
      this.#toggleABloopInterval(false);
      return;
    }

    const vid = this.#vid;
    if (!vid)
      return;

    const validateA = (/** @type number */ aTime) => {
      return !isNaN(aTime) && aTime <= vid.duration
    };

    const validateB = (/** @type number */ bTime, /** @type number */ aTime) => {
      return !isNaN(bTime) && bTime <= vid.duration && bTime > aTime;
    };

    // set current node as current time
    const loopNode = customA == null
      ? vid.currentTime
      : HMStoSec(customA);

    // set A
    if (customB == null && this.#view.aLoop == Infinity) {
      if ( !validateA(loopNode) )
        this.#view.events.fire('view:notify', 'A loop exceeds track length', 'abLoop');
      else {
        this.#view.aLoop = loopNode;
        this.#view.events.fire('view:notify', `A loop at ${secToHMS(loopNode, true)}`, 'abLoop');
      }
    }

    // set B
    else if (customB == null && this.#view.bLoop == Infinity) {
      if ( !validateB(loopNode, this.#view.aLoop) )   {
        this.abLoop(null);
        this.#view.events.fire('view:notify', 'B loop before A, clear', 'abLoop');
      } else {
        this.#view.bLoop = loopNode;
        !vid.paused && this.#toggleABloopInterval(true);
        this.#view.events.fire('view:notify', `B loop at ${secToHMS(loopNode, true)}`, 'abLoop');
      }
    }

    // set A and B
    else if (customA != null && customB != null) {
      const Anode = HMStoSec(customA), 
            Bnode = HMStoSec(customB);

      if ( !validateA(Anode) || !validateB(Bnode, Anode) )
        this.#view.events.fire('view:notify', 'invalid AB loop range', 'abLoop');
      else {
        this.#view.aLoop = Anode;
        this.#view.bLoop = Bnode;
        !vid.paused && this.#toggleABloopInterval(true);
        this.#view.events.fire('view:notify', 'AB loop set', 'abLoop');
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
   * @param {boolean} start Either to start interval. Clear if false.
   */
  #toggleABloopInterval(start) {
    if (!start)
      return clearInterval(this.#abLoopTimer);

    const vid = this.#vid;
    if (!vid)
      return;

    // best effort to enforce ABloop on time
    this.#abLoopTimer = setInterval(() => {
      if (vid.currentTime + .010 >= this.#view.bLoop)
        vid.currentTime = this.#view.aLoop;
    }, 10);
  }
}
