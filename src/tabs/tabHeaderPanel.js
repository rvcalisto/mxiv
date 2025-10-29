// @ts-check

const headerPanel   = /** @type {HTMLElement} */ (document.querySelector('header'));
const tabsContainer = /** @type {HTMLElement} */ (document.querySelector('#tabs'));
const newTabButton  = /** @type {HTMLElement} */ (document.querySelector('#newTab'));
const scrollHeaderL = /** @type {HTMLElement} */ (document.querySelector('#tabScrollL'));
const scrollHeaderR = /** @type {HTMLElement} */ (document.querySelector('#tabScrollR'));

/**
 * Default header panel height. For `toggleVisibility` animation interpolation.
 */
const headerPanelHeight = getComputedStyle(headerPanel).height;

/**
 * Gap between tab elements. For `slideIntoView` focus correction.
 */
const tabsContainerGap = Number.parseInt( getComputedStyle(headerPanel).gap );

/**
 * Header panel visibility state before going fullscreen.
 */
let preFSVisibility = isVisible();

/**
 * Either tabs surpassed the container overflow threshold.
 */
let overflowMode = false;

/**
 * Smooth scroll interval properties for wheel events.
 */
const wheelScroll = {
  interval: /** @type {NodeJS.Timeout|undefined} */ (undefined),
  velocity: 0
};

/**
 * Smooth scroll interval properties for `slideIntoView`.
 */
const slideScroll = {
  interval: /** @type {NodeJS.Timeout|undefined} */ (undefined),
  iteration: 0,
  iterations: 10,
  step: 0
};


/**
 * Add tab item to header panel. Trigger overflow reflow.
 * @param {HTMLElement} element
 * @param {HTMLElement} [after]
 */
export function addItem(element, after) {
  if (after != null)
    after.after(element);
  else if (overflowMode)
    tabsContainer.append(element);
  else
    newTabButton.before(element);

  treatOverflow();
}

/**
 * Remove tab item from header. Trigger overflow reflow.
 * @param {HTMLElement} element
 */
export function removeItem(element) {
  element.remove();
  treatOverflow();
}

/**
 * Get necessary distance to scroll element into focus.
 * @param {HTMLElement} element
 * @returns {number}
 */
function getScrollDistance(element) {
  const containerRect = tabsContainer.getBoundingClientRect();
  const rect = element.getBoundingClientRect();

  let distance = 0;
  if (rect.left < containerRect.left)
    distance = rect.left - tabsContainer.offsetLeft;
  else if (rect.right > containerRect.right)
    distance = rect.right - tabsContainer.offsetWidth - tabsContainer.offsetLeft;
  else
    return 0;

  // extra push to consume tab items container drop-shadow padding on extremes
  distance += element.nextElementSibling == null ? tabsContainerGap :
  element.previousElementSibling == null ? -tabsContainerGap : 0;

  return distance;
}

/**
 * Smoothly scroll element into view at a constant time (100ms by default).
 * @param {HTMLElement} element
 * @param {number} [iterations=10] Number of 10ms intervals to use. Default to 10.
 */
export function slideIntoView(element, iterations = 10) {
  if (tabsContainer.offsetWidth === tabsContainer.scrollWidth)
    return;

  const distance = getScrollDistance(element);
  if (distance === 0)
    return;

  slideScroll.iteration = 0;
  slideScroll.iterations = iterations;
  slideScroll.step = distance > 0
    ? Math.ceil(distance / iterations)
    : Math.floor(distance / iterations);

  if (slideScroll.interval != null)
    return;

  clearInterval(wheelScroll.interval);
  wheelScroll.interval = undefined;

  slideScroll.interval = setInterval(() => {
    tabsContainer.scrollBy(slideScroll.step, 0);

    if (++slideScroll.iteration === slideScroll.iterations) {
      clearInterval(slideScroll.interval);
      slideScroll.interval = undefined;
    }
  }, 10);
}

/**
 * Get Header Bar visibility.
 * @returns {boolean}
 */
export function isVisible() {
  return headerPanel.style.display === '';
}

/**
 * Toggle Header Bar visibility.
 * @param {boolean} [show] Either to force visibility on or off.
 */
export function toggleVisibility( show = !isVisible() ) {
  if ( show === isVisible() )
    return;

  headerPanel.style.display = '';
  treatOverflow();

  const direction = show ? 'normal' : 'reverse';

  headerPanel.animate([
    { height: '0px' }, { height: headerPanelHeight }
  ], { duration: 80, direction }).onfinish = () => {
    headerPanel.style.display = show ? '' : 'none';
  };
}

/**
 * Signal either tab container has any content out-of-frame.
 */
function updateOverflowIndicators() {
  scrollHeaderL.toggleAttribute('disabled', tabsContainer.scrollLeft === 0);

  const scrollPosition = tabsContainer.scrollLeft + tabsContainer.offsetWidth;
  const scrollEnd = tabsContainer.scrollWidth;
  scrollHeaderR.toggleAttribute('disabled', scrollPosition === scrollEnd);
}

/**
 * Move `newTab` button out of overflow container as tabs overflow,
 * move in otherwise. Show/hide overflow indicators, Update `overflowMode`.
 */
function treatOverflow() {
  const overflowing = tabsContainer.clientWidth < tabsContainer.scrollWidth;

  if (overflowing && !overflowMode)
    scrollHeaderR.after(newTabButton);
  else if (!overflowing && overflowMode)
    tabsContainer.append(newTabButton);

  overflowMode = overflowing;
  headerPanel.toggleAttribute('overflow', overflowing);

  if (overflowing) {
    updateOverflowIndicators();

    const selectedTab = /** @type {HTMLElement?} */ (tabsContainer.querySelector('.selected'));
    if (selectedTab != null)
      tabsContainer.scrollBy( getScrollDistance(selectedTab), 0 );
  }
}


/**
 * Setup tab header panel event listeners.
 */
function initialize() {
  // toggle tab bar visibility on fullscreen
  elecAPI.onFullscreen((/** @type {boolean} */ isFullscreen) => {
    if (isFullscreen)
      preFSVisibility = isVisible();

    toggleVisibility(isFullscreen ? false : preFSVisibility);
  });

  // treat overflow also on resize
  addEventListener( 'resize', () => treatOverflow() );

  // disable scroll buttons when hitting start/end positions
  tabsContainer.onscroll = () => updateOverflowIndicators();

  // smooth scroll tabs horizontally on default wheel
  headerPanel.addEventListener('wheel', (e) => {
    if (tabsContainer.offsetWidth === tabsContainer.scrollWidth)
      return;

    const speed = Math.max( 5, Math.min(10, Math.abs(wheelScroll.velocity) + 1) );
    wheelScroll.velocity = speed * Math.sign(e.deltaY);

    if (wheelScroll.interval != null)
      return;

    clearInterval(slideScroll.interval);
    slideScroll.interval = undefined;

    wheelScroll.interval = setInterval(() => {
      tabsContainer.scrollBy(wheelScroll.velocity, 0);

      if ( Math.sign(wheelScroll.velocity) === 1 )
        wheelScroll.velocity = Math.max(0, wheelScroll.velocity - .1);
      else
        wheelScroll.velocity = Math.min(0, wheelScroll.velocity + .1);

      if (wheelScroll.velocity === 0) {
        clearInterval(wheelScroll.interval);
        wheelScroll.interval = undefined;
      }
    }, 10);
  }, { passive: true });

  // smooth scroll tab overflow on button press
  scrollHeaderL.onmousedown = () => {
    const interval = setInterval(() => tabsContainer.scrollBy(-5, 0), 10);
    addEventListener('mouseup', () => clearInterval(interval), { once: true });
  }

  scrollHeaderR.onmousedown = () => {
    const interval = setInterval(() => tabsContainer.scrollBy(5, 0), 10);
    addEventListener('mouseup', () => clearInterval(interval), { once: true });
  }
}


initialize();
