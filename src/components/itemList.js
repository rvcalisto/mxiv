// @ts-check

/**
 * Paginated item list for elements. Styling not included.
 * - Generate pages as they are requested, for performance.
 * @template I Item type.
 * @template {HTMLElement} E Element type.
 */
export class ItemList extends HTMLElement {

  static tagName = 'item-list';

  /**
   * Keeps track of items yet to be rendered on demand.
   * @type {{ unrendered:boolean, items:I[] }[]}
   */
  #virtualPages = [];

  /** @type {(item:I)=>E} */
  #itemGenerator;

  /** @type {HTMLDivElement}       */ #pageContainerDiv;
  /** @type {HTMLDivElement}       */ #paginatorDiv;
  /** @type {HTMLButtonElement}    */ #paginatorBtnL;
  /** @type {HTMLButtonElement}    */ #paginatorBtnR;
  /** @type {HTMLParagraphElement} */ #paginatorLabel;

  constructor() {
    super();
    this.itemsPerPage = 200;
    this.currentPage = 0;
    this.currentPageDiv;
  }

  connectedCallback() {
    // page container
    this.#pageContainerDiv = document.createElement('div');
    this.#pageContainerDiv.className = 'pageContainer';
    this.appendChild(this.#pageContainerDiv);

    // paginator container, hidden by default
    this.#paginatorDiv = document.createElement('div');
    this.#paginatorDiv.className = 'paginator';
    this.#paginatorDiv.style.display = 'none';
    this.appendChild(this.#paginatorDiv);

    // paginator elements
    this.#paginatorBtnL = document.createElement('button');
    this.#paginatorBtnL.style.fontFamily = 'font-awesome';
    this.#paginatorBtnL.textContent = ''; // '<' icon
    this.#paginatorBtnL.onclick = () => this.#goToPage(this.currentPage - 1);

    this.#paginatorBtnR = document.createElement('button');
    this.#paginatorBtnR.style.fontFamily = 'font-awesome';
    this.#paginatorBtnR.textContent = ''; // '>' icon
    this.#paginatorBtnR.onclick = () => this.#goToPage(this.currentPage + 1);

    this.#paginatorLabel = document.createElement('p');
    this.#paginatorDiv.append(this.#paginatorBtnL, this.#paginatorLabel, this.#paginatorBtnR);
  }

  /**
   * Populate list with paginated items.
   * @param {I[]} iterableList Items to process.
   * @param {(item:I)=>E} itemGenerator Item HTML element generator.
   * @param {(item:I)=>Boolean} [filterFunc] Item filter. Optional.
   */
  populate(iterableList, itemGenerator, filterFunc) {
    // reset state
    this.currentPage = 0;
    this.currentPageDiv = null;
    this.#pageContainerDiv.textContent = '';
    this.#virtualPages = [];
    this.#itemGenerator = itemGenerator;

    let pageCount = 0, pageItemCount = 0;
    const applyFilter = filterFunc != null;

    for (const item of iterableList) {
      if ( applyFilter && !filterFunc(item) )
        continue;

      // reset pageItemCount and increment page on threshold
      if (pageItemCount === this.itemsPerPage) {
        pageCount++;
        pageItemCount = 0;
      }

      // create new virtual page on pageItemCount zero
      if (pageItemCount === 0)
        this.#virtualPages[pageCount] = {
          unrendered: true,
          items: []
        };

      // append item to virtual page and increment itemCounter
      this.#virtualPages[pageCount].items.push(item);
      pageItemCount++;
    }

    // update paginator and show page (if any)
    this.#updatePaginator();
    if (this.#virtualPages.length > 0)
      this.#goToPage(0);
  }

  #updatePaginator() {
    const pageCount = this.#virtualPages.length;
    this.#paginatorLabel.textContent = `${this.currentPage + 1}/${pageCount}`;
    this.#paginatorDiv.style.display = pageCount < 2 ? 'none' : '';
  }

  /**
   * Create and return page and nested item elements.
   * @param {number} id Page index ID.
   * @returns {HTMLElement} Page element reference.
   */
  #renderPage(id) {
    const pageData = this.#virtualPages[id];

    const page = document.createElement('div');
    page.setAttribute('page', `${id}`);
    page.className = 'itemListPage';
    page.style.display = 'none';

    for (const item of pageData.items)
      page.append( this.#itemGenerator(item) );

    this.#pageContainerDiv.append(page);
    pageData.unrendered = false;

    return page;
  }

  /**
   * Switch to page index and return its element.
   * @param {number} nextPage Page index to go to.
   * @returns {HTMLElement} New page element.
   */
  #goToPage(nextPage) {
    // wrap around available pages
    const pageCount = this.#virtualPages.length;
    this.currentPage = nextPage < 0 ? pageCount - 1 : nextPage % pageCount;

    if (this.#virtualPages[this.currentPage].unrendered)
      this.#renderPage(this.currentPage);

    // hide all pages but current
    this.currentPageDiv = this.#pageContainerDiv.querySelector(`[page='${this.currentPage}']`);
    for (const page of this.#pageContainerDiv.children)
      /** @type {HTMLElement} */ (page).style.display = page === this.currentPageDiv ? '' : 'none';

    this.#updatePaginator();
    return /** @type {HTMLElement} */ (this.currentPageDiv);
  }

  /**
   * Total count of items in list.
   */
  get itemCount() {
    let count = 0;

    this.#virtualPages.forEach((pageData, pageKey) => {
      if (pageData.unrendered) {
        count += pageData.items.length;
      } else {
        const element = this.#pageContainerDiv.querySelector(`[page='${pageKey}']`);
        count += element && element.childElementCount || 0; // in case nodes were removed
      }
    });

    return count;
  }

  /**
   * Return array of items used to populate pages.
   * @returns {I[]}
   */
  get itemArray() {
    const items = [];
    this.#virtualPages.forEach( pageData => items.push(...pageData.items) );

    return items;
  }

  /**
   * Return HTMLElement of first item whose predicate returns true.
   * @param {(item:I, index:number)=>boolean} predicate
   * @returns {E?}
   */
  findItemElement(predicate) {
    let itemIdx = 0; // relative to itemArray

    for ( const [pageKey, pageData] of this.#virtualPages.entries() ) {

      for (let i = 0; i < pageData.items.length; i++) {
        const item = pageData.items[i];

        if ( predicate(item, itemIdx++) ) {
          const pageElement = this.#goToPage(pageKey);
          return /** @type {E} */ (pageElement.children[i]);
        }
      }
    }

    return null;
  }

  /**
   * Navigate ItemList page items. Returns selected Element.
   * @param {boolean} forward Navigation direction.
   * @returns {E?}
   */
  navItems(forward = true) {
    if (this.currentPageDiv == null)
      return null;

    let selection = this.#pageContainerDiv.querySelector('.selected');

    // no selection, focus first-item:first-page or last-item:last-page 
    if (selection == null) {
      const nextPage = this.#goToPage(forward ? 0 : this.#virtualPages.length - 1);
      selection = forward ? nextPage.firstElementChild : nextPage.lastElementChild;

      selection?.classList.add('selected');
      return /** @type {E?} */ (selection);
    }

    // has selection, remove attribute from previous item
    selection.classList.remove('selected');

    // focus sibling or focus current page extreme if selected element is in another page
    if (selection.parentElement === this.currentPageDiv)
      selection = forward ? selection.nextElementSibling : selection.previousElementSibling;
    else
      selection = forward ? this.currentPageDiv.firstElementChild : this.currentPageDiv.lastElementChild;

    // no neighbors at direction, wrap around page(s)
    if (selection == null) {
      const nextPage = this.#goToPage( this.currentPage + (forward ? 1 : -1) );
      selection = forward ? nextPage.firstElementChild : nextPage.lastElementChild;
    }

    selection?.classList.add('selected');
    return /** @type {E?} */ (selection);
  }

  /**
   * Go to respective page and scroll ItemList item element into view. 
   * @param {HTMLElement} itemElement 
   * @param {boolean|ScrollIntoViewOptions} [viewOptions] ScrollIntoView options.
   */
  selectIntoFocus(itemElement, viewOptions = { block: "center" }) {
    const onFocus = this.#pageContainerDiv.querySelector('.selected');
    if (onFocus)
      onFocus.classList.remove('selected');

    const page = /** @type {HTMLElement} */ (itemElement.parentElement).getAttribute('page');
    this.#goToPage( Number(page) );

    itemElement.classList.add('selected');
    itemElement.scrollIntoView(viewOptions);
  }

  /**
   * Return currently selected element, if any.
   * @returns {E?}
   */
  getSelectedElement() {
    return /** @type {E?} */ (this.#pageContainerDiv.querySelector('.selected'));
  }
}

customElements.define(ItemList.tagName, ItemList);
