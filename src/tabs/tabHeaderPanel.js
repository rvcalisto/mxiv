// @ts-check
const headerPanel   = /** @type {HTMLElement} */ (document.querySelector('header'));
const tabsContainer = /** @type {HTMLElement} */ (document.querySelector('#tabs'));
const newTabButton  = /** @type {HTMLElement} */ (document.querySelector('#newTab'));
const scrollHeaderL = /** @type {HTMLElement} */ (document.querySelector('#tabScrollL'));
const scrollHeaderR = /** @type {HTMLElement} */ (document.querySelector('#tabScrollR'));

const headerPanelHeight = getComputedStyle(headerPanel).height;

let preFSVisibility = isVisible();
let overflowMode = false;

let wheelVelocity = 0;
let wheelInterval = /** @type {NodeJS.Timeout|undefined} */ (undefined);


/**
 * Add tab item to header panel. Trigger overflow reflow.
 * @param {HTMLElement} element
 * @param {HTMLElement} after
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
export function toggleVisibility( show = !this.isVisible() ) {
  headerPanel.style.display = '';
  const direction = show ? 'normal' : 'reverse';

  headerPanel.animate([
    { height: '0px' }, { height: headerPanelHeight }
  ], { duration: 80, direction }).onfinish = () => {
    headerPanel.style.display = show ? '' : 'none';
    treatOverflow();
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
  tabsContainer.querySelector('.selected')?.scrollIntoView();

  updateOverflowIndicators();
}


/**
 * Setup tab header panel event listeners.
 */
function initialize() {
  // toggle tab bar visibility on fullscreen
  elecAPI.onFullscreen((_e, /** @type {boolean} */ isFullscreen) => {
    if (isFullscreen)
      preFSVisibility = isVisible();

    toggleVisibility(isFullscreen ? false : preFSVisibility);
  });

  // treat overflow also on resize
  addEventListener( 'resize', () => treatOverflow() );

  // disable scroll buttons when hitting start/end positions
  tabsContainer.onscroll = () => updateOverflowIndicators();

  // smooth scroll tab overflow on wheel
  headerPanel.onwheel = (e) => {
    const speed = Math.max( 5, Math.min(10, Math.abs(wheelVelocity) + 1) );
    wheelVelocity = speed * Math.sign(e.deltaY);

    if (wheelInterval != null)
      return;

    wheelInterval = setInterval(() => {
      tabsContainer.scrollBy(wheelVelocity, 0);

      if ( Math.sign(wheelVelocity) === 1 )
        wheelVelocity = Math.max(0, wheelVelocity - .1);
      else
        wheelVelocity = Math.min(0, wheelVelocity + .1);

      if (wheelVelocity === 0) {
        clearInterval(wheelInterval);
        wheelInterval = undefined;
      }
    }, 10);
  }

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
