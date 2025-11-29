// @ts-check
import { secToHMS } from './trackUtils.js';


/** 
 * Track bar methods for Viewer video elements. 
 */
export class TrackBar {

  /**
   * How many seconds the track keeps visible after becoming inactive.
   */
  static peekDuration = 1.5;

  /** @type {HTMLDivElement}       */ #panelElement;
  /** @type {HTMLDivElement}       */ #trackBar;
  /** @type {HTMLDivElement}       */ #trackTimeBar;
  /** @type {HTMLDivElement}       */ #trackLoopBar;
  /** @type {HTMLParagraphElement} */ #timestamp;
  /** @type {HTMLParagraphElement} */ #pauseIcon;
  /** @type {HTMLParagraphElement} */ #timeLabel;
  /** @type {HTMLParagraphElement} */ #volumeIcon;
  /** @type {HTMLParagraphElement} */ #volumeLabel;
  /** @type {HTMLParagraphElement} */ #playbackIcon;
  /** @type {HTMLParagraphElement} */ #playbackLabel;
  /** @type {HTMLDivElement}       */ #abLoopButton;
  /** @type {HTMLParagraphElement} */ #loopIcon;

  /**
   * Track peek timeout timer.
   * @type {NodeJS.Timeout|undefined}
   */
  #peekTimer;

  /**
   * Host View component.
   * @type {import('./view.js').View}
   */
  #view;
 
  /**
   * HTML Video element to represent.
   * @type {HTMLVideoElement?}
   */
  #videoElement;

  /**
   * Null zeros, colon chars to discard from track time string.
   */
  #HMScharsToDiscard = 0;

  /**
   * @param {import('./view.js').View} view View instance.
   */
  constructor(view) {
    this.#view = view;
    const shadowRoot    = /** @type {ShadowRoot} */ (this.#view.shadowRoot);

    // set references for track elements
    this.#panelElement  = /** @type {HTMLDivElement}       */ (shadowRoot.querySelector('#trackPanel'));
    this.#trackBar      = /** @type {HTMLDivElement}       */ (shadowRoot.querySelector('#vidTrack'));
    this.#trackTimeBar  = /** @type {HTMLDivElement}       */ (shadowRoot.querySelector('#vidTime'));
    this.#trackLoopBar  = /** @type {HTMLDivElement}       */ (shadowRoot.querySelector('#vidLoop'));
    this.#timestamp     = /** @type {HTMLParagraphElement} */ (shadowRoot.querySelector('.timestamp'));
    this.#pauseIcon     = /** @type {HTMLParagraphElement} */ (shadowRoot.querySelector('#trackPause'));
    this.#timeLabel     = /** @type {HTMLParagraphElement} */ (shadowRoot.querySelector('#trackText'));
    this.#volumeIcon    = /** @type {HTMLParagraphElement} */ (shadowRoot.querySelector('#trackMute'));
    this.#volumeLabel   = /** @type {HTMLParagraphElement} */ (shadowRoot.querySelector('#trackVolume'));
    this.#playbackIcon  = /** @type {HTMLParagraphElement} */ (shadowRoot.querySelector('#trackPitch'));
    this.#playbackLabel = /** @type {HTMLParagraphElement} */ (shadowRoot.querySelector('#trackSpeed'));
    this.#abLoopButton  = /** @type {HTMLDivElement}       */ (shadowRoot.querySelector('.abLoop'));
    this.#loopIcon      = /** @type {HTMLParagraphElement} */ (shadowRoot.querySelector('#trackLoop'));

    this.#initEvents();
    this.#panelElement.toggleAttribute('hidden', true);
  }

  /**
   * Monitor video element.
   * @param {HTMLVideoElement} videoElement Media element to monitor.
   */
  attach(videoElement) {
    this.#videoElement = videoElement;
    this.#syncState();
    this.#updateTrack();

    videoElement.ontimeupdate = () => this.#updateTrack();
    videoElement.onmousemove = () => {
      if ( this.#panelElement.hasAttribute('hidden') )
        this.peek();
      else
        this.#resetHideTimeout();
    };

    // store how many leading zeros, colon to slice later
    this.#HMScharsToDiscard = secToHMS(videoElement.duration).length 
                            - secToHMS(videoElement.duration, true).length;
  }

  /**
   * Stop monitoring current video element.
   */
  detach() {
    this.#panelElement.onmouseover = null;
    this.#videoElement = null;
    this.#panelElement.toggleAttribute('hidden', true);
  }

  /**
   * Update state and momentarily show track panel.
   */
  peek() {
    this.#syncState();
    this.#updateTrack();
    this.#resetHideTimeout();
    this.#panelElement.toggleAttribute('hidden', false);
  }
  
  #resetHideTimeout() {
    clearTimeout(this.#peekTimer);

    this.#peekTimer = setTimeout(() => {
      const vid = this.#videoElement;
      const mouseOver = this.#panelElement.matches(':hover');

      if (!mouseOver && vid && !vid.paused && vid.videoWidth > 0)
        this.#panelElement.toggleAttribute('hidden', true);

    }, 1000 * TrackBar.peekDuration);
  }

  /**
   * Sync progression track to video element. 
   */
  #updateTrack() {
    const vid = this.#videoElement;
    if (!vid)
      return;

    const vidDuration = vid.duration;

    // loading . . .
    if ( isNaN(vidDuration) ) {
      this.#trackTimeBar.style.width = '0%';
      this.#timeLabel.textContent = '●●●';
      return;
    }

    // track label
    const duration = secToHMS(vidDuration).slice(this.#HMScharsToDiscard);
    const time = secToHMS(vid.currentTime).slice(this.#HMScharsToDiscard);
    this.#timeLabel.textContent = `${time} / ${duration}`;

    // bar progress
    const value = (vid.currentTime / vidDuration) * 100;
    this.#trackTimeBar.style.width = `${value.toFixed(2)}%`;
  }

  /**
   * Sync labels and icons to current video element state.
   */
  #syncState() {
    const vid = this.#videoElement;
    if (!vid)
      return;

    // sync mute status and volume
    this.#volumeIcon.setAttribute('icon', vid.muted ? 'vol-mute' : 'vol');
    this.#volumeLabel.textContent = `${(vid.volume*100).toFixed(0)}%`;

    // sync pause
    this.#pauseIcon.setAttribute('icon', vid.paused ? 'play' : 'pause');

    // sync loop
    this.#loopIcon.setAttribute('icon', this.#view.onEnd);

    // sync pitch and speed
    this.#playbackIcon.setAttribute('icon', vid.preservesPitch ? 'speed' : 'speed-pitch');
    this.#playbackLabel.textContent = `x${vid.playbackRate.toFixed(2)}`;

    // sync ab loop button
    this.#abLoopButton.setAttribute('state', 
      this.#view.bLoop < Infinity ? 'ab' :
      this.#view.aLoop < Infinity ? 'a' : ''
    );

    // sync ab loop section
    const trackLoopBar = this.#trackLoopBar;
    if (this.#view.aLoop === Infinity) {
      trackLoopBar.style.marginLeft = '0%';
      trackLoopBar.style.width = '0%';
    } else {
      const marginLeft = (this.#view.aLoop / vid.duration) * 100;
      trackLoopBar.style.marginLeft = `${marginLeft.toFixed(2)}%`;
      trackLoopBar.style.width = '2px';

      if (this.#view.bLoop < Infinity) {
        const width = (this.#view.bLoop / vid.duration) * 100;
        trackLoopBar.style.width = `${(width - marginLeft).toFixed(2)}%`;
      }
    }
  }

  /**
   * Get video duration time from track bar mouse click.
   * @param {MouseEvent} e Mouse event.
   * @returns {number} Video position.
   */
  #seekTo(e) {
    const barPosition = e.offsetX / this.#trackBar.clientWidth;

    // outer scope videoElement validation expected
    return /** @type HTMLVideoElement */ (this.#videoElement).duration * barPosition;
  }
  
  /**
   * Trackbar mouse events.
   * @param {MouseEvent} e Mouse event.
   */
  #onMouseTrackHandler(e) {
    const vid = this.#videoElement;
    if (!vid)
      return;

    // seek
    if (e.buttons === 1) {
      const seekTime = this.#seekTo(e);
      vid.currentTime = seekTime;
      this.#updateTrack(); // for instant response
    }

    // ab loop fine-tuning
    else if (e.buttons === 2 && this.#view.bLoop < Infinity) {
      const seekTime = this.#seekTo(e);
      const diffToA = this.#view.aLoop - seekTime;
      const diffToB = this.#view.bLoop - seekTime;

      if ( Math.abs(diffToA) < Math.abs(diffToB) )
        this.#view.aLoop = seekTime;
      else
        this.#view.bLoop = seekTime;

      this.#syncState();
    }

    // show cursor position timestamp, don't go out-bounds
    const timestamp = this.#timestamp;
    timestamp.textContent = secToHMS( this.#seekTo(e), true );
    timestamp.style.transform = `translateX(-50%) translateX(${e.offsetX}px)`;

    const stampRect = timestamp.getBoundingClientRect();
    const trackRect = this.#trackBar.getBoundingClientRect();

    if (stampRect.left < trackRect.left)
      timestamp.style.transform += ` translateX(${trackRect.left - stampRect.left}px)`;
    else if (stampRect.right > trackRect.right)
      timestamp.style.transform += ` translateX(${trackRect.right - stampRect.right}px)`;
  }

  #initEvents() {
    const shadowRoot = /** @type ShadowRoot */ (this.#view.shadowRoot);

    // mute toggle
    const volumeContainer = /** @type HTMLDivElement */ (this.#volumeIcon.parentElement);
    volumeContainer.onclick = () => this.#view.media.muteToggle();

    // volume wheel
    volumeContainer.addEventListener('wheel', (e) => {
      this.#view.media.setVolume(e.deltaY > 0 ? '-5' : '+5');
    }, { passive: true });

    // pitch toggle
    const playbackContainer = /** @type HTMLDivElement */ (this.#playbackIcon.parentElement);
    playbackContainer.onclick = () => this.#view.media.preservePitch();

    // speed wheel
    playbackContainer.addEventListener('wheel', (e) => {
      this.#view.media.playbackRate(e.deltaY > 0 ? '-.25' : '+.25');
    }, { passive: true });

    // ab loop
    this.#abLoopButton.onclick = () => this.#view.media.abLoop();

    // play/pause
    const pauseContainer = /** @type HTMLDivElement */ (this.#pauseIcon.parentElement);
    pauseContainer.onclick = () => this.#view.media.playToggle();

    // skip next
    const skipRico = /** @type HTMLParagraphElement */ (shadowRoot.querySelector('#trackSkipR'));
    skipRico.setAttribute('icon', 'skip-right');

    const skipRContainer = /** @type HTMLDivElement */ (skipRico.parentElement);
    skipRContainer.onclick = () => this.#view.events.fire('view:skip', true);

    // skip previous
    const skipLico = /** @type HTMLParagraphElement */ (shadowRoot.querySelector('#trackSkipL'));
    skipLico.setAttribute('icon', 'skip-left');

    const skipLContainer = /** @type HTMLDivElement */ (skipLico.parentElement);
    skipLContainer.onclick = () => this.#view.events.fire('view:skip', false);

    // loop [⟳], skip [🠖], stop [⇥] at the end of vid
    const loopContainer = /** @type HTMLDivElement */ (this.#loopIcon.parentElement);
    loopContainer.onclick = () => this.#view.media.onEndRepeat();

    // seek track events
    this.#trackBar.onmousedown = (e) => this.#onMouseTrackHandler(e);
    this.#trackBar.onmousemove = (e) => this.#onMouseTrackHandler(e);
  }
}
