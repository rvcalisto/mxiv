/** 
 * Track bar methods for Viewer video elements. 
 */
export class TrackBar {

  /**
   * How many seconds the track keeps visible after becoming inactive.
   */
  static peekDuration = 1.5

  /**
   * Track peek timeout timer.
   * @type {Number?}
   */
  #peekTimer = null

  /**
   * Host View component.
   * @type {import('./view.js').View}
   */
  #view

  /**
   * Track root HTML element contained in View.
   * @type {HTMLDivElement}
   */
  #panelElement
 
  /**
   * HTML Video element to represent.
   * @type {HTMLVideoElement?}
   */
  #videoElement

  /**
   * @param {import('./view.js').View} view View instance.
   */
  constructor(view) {
    this.#view = view
    this.#panelElement = this.#view.shadowRoot.getElementById('trackPanel')

    this.#initEvents()
    this.#panelElement.toggleAttribute('hidden', true)
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
        this.#view.trackBar.peek();
      else
        this.#resetHideTimeout();
    };
  }

  /**
   * Stop monitoring current video element.
   */
  detach() {
    this.#panelElement.onmouseover = null
    this.#videoElement = null
    this.#panelElement.toggleAttribute('hidden', true)
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
    const vid = this.#videoElement
    if (!vid) return
  
    const trackCurrentTime = this.#view.shadowRoot.getElementById('vidTime')
    const trackTimeLabel = this.#view.shadowRoot.getElementById('trackText')
    const vidDuration = vid.duration
  
    // loading . . .
    if (isNaN(vidDuration)) {
      trackCurrentTime.style.width = '0%'
      trackTimeLabel.textContent = '●●●'
      return
    }
  
    // track label
    let duration = this.#view.media.secToHMS(vidDuration)
    let time = this.#view.media.secToHMS(vid.currentTime)

    if ( duration.startsWith('00:') ) {
      duration = duration.slice(3)
      time = time.slice(3)
    }

    trackTimeLabel.textContent = `${time} / ${duration}`
  
    // bar progress
    const value = (vid.currentTime / vidDuration) * 100
    trackCurrentTime.style.width = `${value.toFixed(2)}%`
  }

  /**
   * Sync labels and icons to current video element state.
   */
  #syncState() {
    const vid = this.#videoElement
    if (!vid) return

    // sync mute status and volume
    const muteBtn = this.#view.shadowRoot.getElementById('trackMute')
    muteBtn.setAttribute('icon', vid.muted ? 'vol-mute' : 'vol')
    muteBtn.parentElement.setAttribute('info', `${(vid.volume*100).toFixed(0)}%`)
    // sync pause
    const pauseBtn = this.#view.shadowRoot.getElementById('trackPause')
    pauseBtn.setAttribute('icon', vid.paused ? 'play' : 'pause')
    // sync loop
    const loopBtn = this.#view.shadowRoot.getElementById('trackLoop')
    loopBtn.setAttribute('icon', this.#view.onEnd)
    // sync pitch and speed
    const pitchBtn = this.#view.shadowRoot.getElementById('trackPitch')
    pitchBtn.setAttribute('icon', vid.preservesPitch ? 'speed' : 'speed-pitch')
    pitchBtn.parentElement.setAttribute('info', `x${vid.playbackRate.toFixed(2)}`)
    // sync ab loop button
    const abLoopBtn = this.#view.shadowRoot.querySelector('.abLoop')
    abLoopBtn.setAttribute('state', 
      this.#view.bLoop < Infinity ? 'ab' :
      this.#view.aLoop < Infinity ? 'a' : ''
    )
    // sync ab loop section
    const trackLoopBar = this.#view.shadowRoot.getElementById('vidLoop')
    if (this.#view.aLoop < Infinity) {
      const marginLeft = (this.#view.aLoop / vid.duration) * 100
      trackLoopBar.style.marginLeft = `${marginLeft.toFixed(2)}%`
      trackLoopBar.style.width = '2px'
      
      if (this.#view.bLoop < Infinity) {
        const width = (this.#view.bLoop / vid.duration) * 100
        trackLoopBar.style.width = `${width.toFixed(2) - marginLeft.toFixed(2)}%`
      }
    } else {
      trackLoopBar.style.marginLeft = '0%'
      trackLoopBar.style.width = '0%'
    }
  }

  /**
   * Get video duration time from track bar mouse click.
   * @param {MouseEvent} e Mouse event.
   * @returns {Number} Video position.
   */
  #seekTo(e) {
    const trackBar = this.#view.shadowRoot.getElementById('vidTrack');
    const barPosition = e.offsetX / trackBar.clientWidth;
    
    return this.#videoElement.duration * barPosition;
  }
  
  /**
   * Trackbar mouse events.
   * @param {MouseEvent} e Mouse event.
   */
  #onMouseTrackHandler(e) {
    const vid = this.#videoElement;
    if (!vid) return;

    // seek
    if (e.buttons == 1) {
      const seekTime = this.#seekTo(e);
      vid.currentTime = seekTime;
      this.#updateTrack(); // for instant response
    }

    // ab loop fine-tuning
    else if (e.buttons == 2 && this.#view.bLoop < Infinity) {
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
    const timestamp = this.#panelElement.querySelector('.timestamp');
    const time = this.#view.media.secToHMS( this.#seekTo(e) );
    timestamp.textContent = time.startsWith('00') ? time.slice(3) : time;

    timestamp.style.transform = `translateX(-50%) translateX(${e.offsetX}px)`;

    const track = this.#panelElement.querySelector('#vidTrack');
    const stampRect = timestamp.getBoundingClientRect();
    const trackRect = track.getBoundingClientRect();

    if (stampRect.left < trackRect.left)
      timestamp.style.transform += ` translateX(${trackRect.left - stampRect.left}px)`;
    else if (stampRect.right > trackRect.right)
      timestamp.style.transform += ` translateX(${trackRect.right - stampRect.right}px)`;
  }

  #initEvents() {
    // mute toggle
    const muteBtn = this.#view.shadowRoot.getElementById('trackMute')
    muteBtn.parentElement.onclick = () => this.#view.media.muteToggle()

    // volume wheel
    muteBtn.parentElement.addEventListener('wheel', (e) => {
      this.#view.media.setVolume(e.deltaY > 0 ? '-5' : '+5')
    }, { passive: true })

    // pitch toggle
    const speedBtn = this.#view.shadowRoot.getElementById('trackPitch')
    speedBtn.parentElement.onclick = () => this.#view.media.preservePitch()

    // speed wheel
    speedBtn.parentElement.addEventListener('wheel', (e) => {
      this.#view.media.playbackRate(e.deltaY > 0 ? '-.25' : '+.25')
    }, { passive: true })

    // ab loop
    const abLoopBtn = this.#view.shadowRoot.querySelector('.abLoop')
    abLoopBtn.onclick = () => this.#view.media.abLoop()

    // play/pause
    const pauseBtn = this.#view.shadowRoot.getElementById('trackPause')
    pauseBtn.parentElement.onclick = () => this.#view.media.playToggle()

    // skip next
    const skipRBtn = this.#view.shadowRoot.getElementById('trackSkipR')
    skipRBtn.parentElement.onclick = () => this.#view.events.fire('view:skip', true)
    skipRBtn.setAttribute('icon', 'skip-right')

    // skip previous
    const skipLBtn = this.#view.shadowRoot.getElementById('trackSkipL')
    skipLBtn.parentElement.onclick = () => this.#view.events.fire('view:skip', false)
    skipLBtn.setAttribute('icon', 'skip-left')

    // loop [⟳], skip [🠖], stop [⇥] at the end of vid
    const loopBtn = this.#view.shadowRoot.getElementById('trackLoop')
    loopBtn.parentElement.onclick = () => this.#view.media.onEndRepeat()

    // seek track events
    const trackBar = this.#view.shadowRoot.getElementById('vidTrack')
    trackBar.onmousedown = (e) => this.#onMouseTrackHandler(e);
    trackBar.onmousemove = (e) => this.#onMouseTrackHandler(e);
  }
}
