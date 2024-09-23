// @ts-check

/**
 * Tabs Container div.
 */
const tabsContainer = /** @type {HTMLElement} */ (document.querySelector('header'));

/**
 * Dragged tab.
 * @type {HTMLElement?}
 */
let selectedTab = null;

/**
 * Target to drop dragged tab.
 * @type {HTMLElement?}
 */
let targetTab = null;

/**
 * Either to insert dragged tab before or after target.
 */
let insertBefore = false;

/**
 * Mouse client x position at first press.
 */
let initialClientX = 0;

/**
 * Get tab HTML elements from container.
 * @returns {HTMLElement[]}
 */
const getTabElements = () => /** @type {HTMLElement[]} */ ([...tabsContainer.children]);


/**
 * Check mouse drag threshold. Move to next phase on pass.
 * @param {MouseEvent} e
 */
function onDragThreshold(e) {
  if (selectedTab != null && e.buttons === 1 && e.button === 0) {
    if ( Math.abs(initialClientX - e.clientX) < 15 )
      return;
    
    selectedTab.style.zIndex = '99';
    removeEventListener('mousemove', onDragThreshold);
    addEventListener('mousemove', onDragTab);
    
    getTabElements().forEach(element => {
      element.style.pointerEvents = 'none';
      if (element !== selectedTab)
        element.classList.add('animated');
    });
  }
}

/**
 * Slide tabs as cursor hovers over them. Update target tab.
 * @param {MouseEvent} e
 */
function onDragTab(e) {
  if (selectedTab == null)
    return;
  
  const tabElements = getTabElements();
  const tabWidth = tabElements[0].clientWidth;
  
  const gap = Number.parseInt( getComputedStyle(tabsContainer).gap );
  tabsContainer.style.setProperty('--px-slide-offset', `${tabWidth + gap}px`);
  
  const mouseDelta = e.clientX - initialClientX;
  selectedTab.style.transform = `translateX(${mouseDelta}px)`;
  
  const selectedTabLeft = selectedTab.offsetLeft;
  const draggedTabLeft = selectedTab.offsetLeft + mouseDelta;
  const draggedTabCenter = draggedTabLeft + tabWidth / 2;
  insertBefore = draggedTabLeft < selectedTabLeft;
  
  let leftmostTab = null;
  tabElements.forEach(element => {
    if ( !element.classList.contains('tab') )
      return;
    
    const currentTabLeft = element.offsetLeft;
    const currentTabRight = element.offsetLeft + tabWidth;
    
    if (insertBefore) {
      if (currentTabLeft > selectedTabLeft)
        return; // skip elements right of selection
      
      if (draggedTabCenter < currentTabRight) {
        element.classList.add('slide-right');
        if (leftmostTab == null)
          leftmostTab = targetTab = element;
      } else {
        element.classList.remove('slide-right');
      }
    } else {
      if (currentTabLeft < selectedTabLeft)
        return; // skip elements left of selection
      
      if (draggedTabCenter > currentTabLeft) {
        element.classList.add('slide-left');
        targetTab = element;
      } else {
        element.classList.remove('slide-left');
      }
    }
  });
}

/**
 * Apply reordering, clear state and event listeners.
 * @param {MouseEvent} _
 */
function onDragRelease(_) {
  if (selectedTab != null && targetTab != null)
    insertBefore ?
      targetTab.before(selectedTab) :
      targetTab.after(selectedTab);
  
  removeEventListener('mousemove', onDragThreshold);
  removeEventListener('mousemove', onDragTab);
  removeEventListener('mouseup', onDragRelease);
  
  selectedTab = null;
  targetTab = null;
  
  getTabElements().forEach(element => {
    element.removeAttribute('style');
    element.classList.remove('slide-left', 'slide-right', 'animated');
  });
}

/**
 * Setup drag event cycle for tab element.
 * @param {HTMLElement} tabElement
 */
export default function setDragEvent(tabElement) {
  tabElement.onmousedown = (e) => {
    initialClientX = e.clientX;
    selectedTab = tabElement;
    
    addEventListener('mousemove', onDragThreshold);
    addEventListener('mouseup', onDragRelease);
  };
}
