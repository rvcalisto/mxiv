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
   * Track root HTML element contained in View.
   * @type {HTMLDivElement}
   */
  #panelElement;
 
  /**
   * HTML Video element to represent.
   * @type {HTMLVideoElement?}
   */
  #videoElement;

  /**
   * @param {import('./view.js').View} view View instance.
   */
  constructor(view) {
    this.#view = view;
    const shadowRoot = /** @type ShadowRoot */ (this.#view.shadowRoot);
    this.#panelElement = /** @type HTMLDivElement */ (shadowRoot.getElementById('trackPanel'));

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

    const shadowRoot = /** @type ShadowRoot */ (this.#view.shadowRoot);
    const trackCurrentTime = /** @type HTMLDivElement */ (shadowRoot.getElementById('vidTime'));
    const trackTimeLabel = /** @type HTMLParagraphElement */ (shadowRoot.getElementById('trackText'));
    const vidDuration = vid.duration;

    // loading . . .
    if ( isNaN(vidDuration) ) {
      trackCurrentTime.style.width = '0%';
      trackTimeLabel.textContent = '●●●';
      return;
    }

    // track label
    let duration = secToHMS(vidDuration);
    let time = secToHMS(vid.currentTime);

    if ( duration.startsWith('00:') ) {
      duration = duration.slice(3);
      time = time.slice(3);
    }

    trackTimeLabel.textContent = `${time} / ${duration}`;
  
    // bar progress
    const value = (vid.currentTime / vidDuration) * 100;
    trackCurrentTime.style.width = `${value.toFixed(2)}%`;
  }

  /**
   * Sync labels and icons to current video element state.
   */
  #syncState() {
    const vid = this.#videoElement;
    if (!vid)
      return;

    const shadowRoot = /** @type ShadowRoot */ (this.#view.shadowRoot);

    // sync mute status and volume
    const muteIco = /** @type HTMLParagraphElement */ (shadowRoot.getElementById('trackMute'));
    muteIco.setAttribute('icon', vid.muted ? 'vol-mute' : 'vol');

    const muteContainer = /** @type HTMLDivElement */ (muteIco.parentElement);
    muteContainer.setAttribute('info', `${(vid.volume*100).toFixed(0)}%`);

    // sync pause
    const pauseIco = /** @type HTMLParagraphElement */ (shadowRoot.getElementById('trackPause'));
    pauseIco.setAttribute('icon', vid.paused ? 'play' : 'pause');

    // sync loop
    const loopIco = /** @type HTMLParagraphElement */ (shadowRoot.getElementById('trackLoop'));
    loopIco.setAttribute('icon', this.#view.onEnd);

    // sync pitch and speed
    const pitchIco = /** @type HTMLParagraphElement */ (shadowRoot.getElementById('trackPitch'));
    pitchIco.setAttribute('icon', vid.preservesPitch ? 'speed' : 'speed-pitch');

    const pitchContainer = /** @type HTMLDivElement */ (pitchIco.parentElement);
    pitchContainer.setAttribute('info', `x${vid.playbackRate.toFixed(2)}`);

    // sync ab loop button
    const abLoopBtn = /** @type HTMLParagraphElement */ (shadowRoot.querySelector('.abLoop'));
    abLoopBtn.setAttribute('state', 
      this.#view.bLoop < Infinity ? 'ab' :
      this.#view.aLoop < Infinity ? 'a' : ''
    );

    // sync ab loop section
    const trackLoopBar = /** @type HTMLParagraphElement */ (shadowRoot.getElementById('vidLoop'));
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
    const shadowRoot = /** @type ShadowRoot */ (this.#view.shadowRoot);
    const trackBar = /** @type HTMLDivElement */ (shadowRoot.getElementById('vidTrack'));
    const barPosition = e.offsetX / trackBar.clientWidth;

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
    const timestamp = /** @type {HTMLParagraphElement}*/ (this.#panelElement.querySelector('.timestamp'));
    const time = secToHMS( this.#seekTo(e) );
    timestamp.textContent = time.startsWith('00') ? time.slice(3) : time;
    timestamp.style.transform = `translateX(-50%) translateX(${e.offsetX}px)`;

    const track = /** @type {HTMLDivElement}*/ (this.#panelElement.querySelector('#vidTrack'));
    const stampRect = timestamp.getBoundingClientRect();
    const trackRect = track.getBoundingClientRect();

    if (stampRect.left < trackRect.left)
      timestamp.style.transform += ` translateX(${trackRect.left - stampRect.left}px)`;
    else if (stampRect.right > trackRect.right)
      timestamp.style.transform += ` translateX(${trackRect.right - stampRect.right}px)`;
  }

  #initEvents() {
    const shadowRoot = /** @type ShadowRoot */ (this.#view.shadowRoot);

    // mute toggle
    const muteIco = /** @type HTMLParagraphElement */ (shadowRoot.getElementById('trackMute'));
    const muteContainer = /** @type HTMLDivElement */ (muteIco.parentElement);
    muteContainer.onclick = () => this.#view.media.muteToggle();

    // volume wheel
    muteContainer.addEventListener('wheel', (e) => {
      this.#view.media.setVolume(e.deltaY > 0 ? '-5' : '+5');
    }, { passive: true });

    // pitch toggle
    const speedIco = /** @type HTMLParagraphElement */ (shadowRoot.getElementById('trackPitch'));
    const speedContainer = /** @type HTMLDivElement */ (speedIco.parentElement);
    speedContainer.onclick = () => this.#view.media.preservePitch();

    // speed wheel
    speedContainer.addEventListener('wheel', (e) => {
      this.#view.media.playbackRate(e.deltaY > 0 ? '-.25' : '+.25');
    }, { passive: true });

    // ab loop
    const abLoopBtn = /** @type HTMLDivElement */ (shadowRoot.querySelector('.abLoop'));
    abLoopBtn.onclick = () => this.#view.media.abLoop();

    // play/pause
    const pauseIco = /** @type HTMLParagraphElement */ (shadowRoot.getElementById('trackPause'));
    const pauseContainer = /** @type HTMLDivElement */ (pauseIco.parentElement);
    pauseContainer.onclick = () => this.#view.media.playToggle();

    // skip next
    const skipRico = /** @type HTMLParagraphElement */ (shadowRoot.getElementById('trackSkipR'));
    skipRico.setAttribute('icon', 'skip-right');

    const skipRContainer = /** @type HTMLDivElement */ (skipRico.parentElement);
    skipRContainer.onclick = () => this.#view.events.fire('view:skip', true);

    // skip previous
    const skipLico = /** @type HTMLParagraphElement */ (shadowRoot.getElementById('trackSkipL'));
    skipLico.setAttribute('icon', 'skip-left');

    const skipLContainer = /** @type HTMLDivElement */ (skipLico.parentElement);
    skipLContainer.onclick = () => this.#view.events.fire('view:skip', false);

    // loop [⟳], skip [🠖], stop [⇥] at the end of vid
    const loopIco = /** @type HTMLParagraphElement */ (shadowRoot.getElementById('trackLoop'));
    const loopContainer = /** @type HTMLDivElement */ (loopIco.parentElement);
    loopContainer.onclick = () => this.#view.media.onEndRepeat();

    // seek track events
    const trackBar = /** @type HTMLDivElement */ (shadowRoot.getElementById('vidTrack'));
    trackBar.onmousedown = (e) => this.#onMouseTrackHandler(e);
    trackBar.onmousemove = (e) => this.#onMouseTrackHandler(e);
  }
}
