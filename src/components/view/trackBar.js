/** 
 * Track bar methods for Viewer video elements. 
 */
export class TrackBar {

  /** How many seconds the track keeps visible after becoming inactive. */
  static peekDuration = 1.5

  /** Track peek timeout timer.
   * @type {Number?} */
  #peekTimer = null

  /** Parent View component.
   * @type {import('./view.js').View} */
  #view

  /** Track root HTML element contained in View.
   * @type {HTMLDivElement}
   */
  #panelElement
 
  /** HTML Video element to represent.
   * @type {HTMLVideoElement?} */
  #videoElement

  /**
   * @param {import('./view.js').View} view View instance.
   */
  constructor(view) {
    this.#view = view
    this.#panelElement = this.#view.shadowRoot.getElementById('trackPanel')

    this.#initListeners()
    this.hide()
  }

  /**
   * Monitor video element.
   * @param {HTMLVideoElement} videoElement Media element to monitor.
   */
  attach(videoElement) {
    this.#videoElement = videoElement
    this.syncState()
    this.updateTrack()

    // keep track panel visible on hover
    this.#panelElement.onmouseover = () => {
      this.peek()
      clearTimeout(this.#peekTimer)
    }
  }

  /**
   * Stop monitoring current video element.
   */
  detach() {
    this.#panelElement.onmouseover = null
    this.#videoElement = null
    this.hide()
  }

  /**
   * Sync and show track bar momentarily.
   */
  peek() {
    this.syncState()
    clearTimeout(this.#peekTimer)
    this.hide(false)

    this.#peekTimer = setTimeout(() => {
      const vid = this.#videoElement
      // videoWidth == 0 : audio-only
      if (vid && !vid.paused && vid.videoWidth) this.hide()
    }, 1000 * TrackBar.peekDuration);
  }

  /**
   * Hide track bar. Show if false.
   * @param {true} hide 
   */
  hide(hide = true) {
    const trackPanel = this.#panelElement
    if (trackPanel.style.opacity == 0 && !hide) this.updateTrack()
    trackPanel.style.opacity = hide ? 0 : 1
    trackPanel.style.visibility = hide ? 'hidden' : 'visible'
    trackPanel.style.height = hide ? '0' : 'fit-content'
    trackPanel.style.margin = hide ? '0px' : ''
  }

  /**
   * Sync progression track to video element. 
   */
  updateTrack() {
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
    const duration = this.#view.media.secToHMS(vidDuration)
    const time = this.#view.media.secToHMS(vid.currentTime)
    trackTimeLabel.textContent = `${time} / ${duration}`
  
    // bar progress
    const value = (vid.currentTime / vidDuration) * 100
    trackCurrentTime.style.width = `${value.toFixed(2)}%`
  }

  /**
   * Sync labels and icons to current video element state.
   */
  syncState() {
    const vid = this.#videoElement
    if (!vid) return

    // sync mute
    const muteBtn = this.#view.shadowRoot.getElementById('trackMute')
    muteBtn.setAttribute('icon', vid.muted ? 'vol-mute' : 'vol')
    // sync pause
    const pauseBtn = this.#view.shadowRoot.getElementById('trackPause')
    pauseBtn.setAttribute('icon', vid.paused ? 'play' : 'pause')
    // sync vol
    const volLabel = this.#view.shadowRoot.getElementById('volumeText')
    volLabel.textContent = `${(vid.volume*100).toFixed(0)}%`
    // sync loop
    const loopBtn = this.#view.shadowRoot.getElementById('trackLoop')
    loopBtn.setAttribute('icon', this.#view.onEnd)
  }

  /**
   * Get video duration time from track bar mouse click.
   * @param {MouseEvent} e Mouse event.
   * @returns {Number} Video position.
   */
  #seekTo(e) {
    const trackBar = this.#view.shadowRoot.getElementById('vidTrack')
    const vid = this.#videoElement
    const barPosition = e.offsetX / trackBar.clientWidth
    const vidPosition = vid.duration * barPosition
    return vidPosition
  }


  #initListeners() {
    // mute toggle
    const muteBtn = this.#view.shadowRoot.getElementById('trackMute')
    muteBtn.parentElement.onclick = () => this.#view.media.muteToggle()

    // volume wheel
    muteBtn.parentElement.addEventListener('wheel', (e) => {
      this.#view.media.setVolume(e.deltaY > 0 ? '-5' : '+5')
    }, {passive: true})

    // ⏸⯈
    const pauseBtn = this.#view.shadowRoot.getElementById('trackPause')
    pauseBtn.onclick = () => this.#view.media.playToggle()

    // ⮞
    const skipRBtn = this.#view.shadowRoot.getElementById('trackSkipR')
    skipRBtn.onclick = () => this.#view.signalEvent('view:next')
    skipRBtn.setAttribute('icon', 'skip-right')

    // ⮜
    const skipLBtn = this.#view.shadowRoot.getElementById('trackSkipL')
    skipLBtn.onclick = () => this.#view.signalEvent('view:previous')
    skipLBtn.setAttribute('icon', 'skip-left')

    // loop [⟳], skip [🠖], stop [⇥] at the end of vid
    const loopBtn = this.#view.shadowRoot.getElementById('trackLoop')
    loopBtn.onclick = () => this.#view.media.onEndRepeat()

    const trackBar = this.#view.shadowRoot.getElementById('vidTrack')

    // seek time on track click
    trackBar.onmousedown = (e) => {
      const vid = this.#videoElement
      if (!vid) return

      const seekTime = this.#seekTo(e)
      if (e.buttons == 1) vid.currentTime = seekTime
      if (e.buttons == 2) this.#view.media.abLoop() // loop
      // vid updates slowly, update bar for visual smoothness
      this.updateTrack()
    }
    // seek time ob track drag
    trackBar.onmousemove = (e) => {
      const vid = this.#videoElement
      if (vid && e.buttons == 1) {
        const seekTime = this.#seekTo(e)
        vid.currentTime = seekTime
        // vid updates slowly, update bar for visual smoothness
        this.updateTrack()
      }
    }
  }
}