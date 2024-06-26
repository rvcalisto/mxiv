/**
 * Paginated item list for elements. Styling not included.
 * - Generate pages as they are requested, for perfomance.
 * @template I Item type.
 * @template {HTMLElement} E Element type.
 */
export class ItemList extends HTMLElement {

  static tagName = 'item-list'

  /**
   * Keeps track of items yet to be rendered on demand.
   * @type {Object<number, {unrendered:boolean, items:I[]}>}
   */
  #virtualPages = {}

  /** @type {(item:I)=>E} */
  #itemGenerator

  constructor() {
    super()
    this.pageContainerDiv
    this.paginatorDiv
    this.paginatorBtnL
    this.paginatorBtnR
    this.paginatorLabel
    this.itemsPerPage = 200
    this.currentPage = 0
    this.currentPageDiv
  }

  connectedCallback() {
    // page container
    this.pageContainerDiv = document.createElement('div')
    this.pageContainerDiv.className = 'pageContainer'
    this.appendChild(this.pageContainerDiv)

    // paginator and hide by default
    this.paginatorDiv = document.createElement('div')
    this.paginatorDiv.className = 'paginator'
    this.paginatorDiv.style.display = 'none'
    this.appendChild(this.paginatorDiv)

    // paginator elements
    this.paginatorBtnL = document.createElement('button')
    this.paginatorBtnL.style.fontFamily = 'font-awesome'
    this.paginatorBtnL.textContent = '' // '<' icon

    this.paginatorBtnR = document.createElement('button')
    this.paginatorBtnR.style.fontFamily = 'font-awesome'
    this.paginatorBtnR.textContent = '' // '>' icon
    
    this.paginatorLabel = document.createElement('p')
    this.paginatorDiv.append(this.paginatorBtnL, this.paginatorLabel, this.paginatorBtnR)
  }

  /**
   * Populate list with paginated items.
   * @param {I[]} iterableList Items to process.
   * @param {(item:I)=>E} itemGenerator Item HTML element generator.
   * @param {(item:I)=>Boolean} [filterFunc] Item filter. Optional.
   */
  populate(iterableList, itemGenerator, filterFunc) {

    // reset state
    this.currentPage = 0
    this.pageContainerDiv.textContent = ''
    this.#virtualPages = {}
    this.#itemGenerator = itemGenerator
    
    let pageCount = 0, pageItemCount = 0

    for (const item of iterableList) {
      // filter item with given function, else, pass
      const pass = filterFunc ? filterFunc(item) : true
      if (!pass) continue

      // new page & item indexes on per-page-item-limit
      if (pageItemCount === this.itemsPerPage) {
        pageCount++
        pageItemCount = 0
      }

      // define new virtual page on itemCount zero
      if (pageItemCount === 0) this.#virtualPages[pageCount] = {
        unrendered: true,
        items: []
      }

      // append item to virtual page and increment itemCounter
      this.#virtualPages[pageCount].items.push(item)
      pageItemCount++
    }

    // update paginator and show page (if any)
    this.#updatePaginator()
    if ( this.#virtualPages[0] != null ) this.goToPage(0)
  }

  #updatePaginator() {
    const pageCount = Object.keys(this.#virtualPages).length
    this.paginatorLabel.textContent = `${this.currentPage + 1}/${pageCount}`

    this.paginatorBtnL.onclick = () => this.goToPage(this.currentPage - 1)
    this.paginatorBtnR.onclick = () => this.goToPage(this.currentPage + 1)

    this.paginatorDiv.style.display = pageCount < 2 ? 'none' : ''
  }

  /**
   * Create and return page and nested item elements.
   * @param {Number} id
   * @returns {HTMLElement} Page element reference.
   */
  #renderPage(id) {
    const pageData = this.#virtualPages[id]

    const page = document.createElement('div')
    page.setAttribute('page', id)
    page.className = 'itemListPage'
    page.style.display = 'none'

    for (const item of pageData.items) {
      page.append( this.#itemGenerator(item) )
    }

    this.pageContainerDiv.append(page)
    pageData.unrendered = false
    // console.log('rendered page:', id)
    return page
  }

  /**
   * Switch page. Returns page element on success, false otherwise.
   * @param {Number} nextPage Page index to go to.
   * @returns {HTMLElement} New page element.
   */
  goToPage(nextPage) {

    // wrap nextPage around avaliable pages
    const pageCount = Object.keys(this.#virtualPages).length
    if (nextPage > pageCount - 1) nextPage = 0
    if (nextPage < 0) nextPage = pageCount - 1
    this.currentPage = nextPage

    // render and show if unrendered
    if (this.#virtualPages[nextPage].unrendered) this.#renderPage(nextPage)

    // hide all pages but next
    const pageElements = this.pageContainerDiv.children
    let nextPageElement
    for (const page of pageElements) {
      if ( page.getAttribute('page') == nextPage ) nextPageElement = page
      page.style.display = page === nextPageElement ? '' : 'none'
    }

    // update paginator display
    this.paginatorLabel.textContent = `${nextPage + 1}/${pageCount}`
    this.currentPageDiv = nextPageElement

    // return page element, used in navItems
    return nextPageElement
  }

  /**
   * Total count of items in list.
   */
  get itemCount() {
    let count = 0
    for (const pageKey in this.#virtualPages) {
      const pageData = this.#virtualPages[pageKey]
      if (pageData.unrendered) count += pageData.items.length
      else {
        const element = this.pageContainerDiv.querySelector(`[page='${pageKey}']`)
        if (element) count += element.childElementCount // in case nodes were removed
      }
    }

    return count
  }

  /**
   * Return array of items used to populate pages.
   * @returns {I[]}
   */
  get itemArray() {
    let items = []

    for (const key in this.#virtualPages) {
      const page = this.#virtualPages[key]
      items = items.concat(page.items)
    }

    return items
  }

  /**
   * Return HTMLElement of first item whose predicate returns true.
   * @param {(item:I, index:number)=>boolean} predicate
   * @returns {E?}
   */
  findItemElement(predicate) {
    let itemIdx = 0 // relative to itemArray

    for (const pageKey in Object.keys(this.#virtualPages) ) {
      const pageData = this.#virtualPages[pageKey]

      for (let i = 0; i < pageData.items.length; i++) {
        const item = pageData.items[i]
        const truthy = predicate(item, itemIdx)
        
        if (truthy) {
          this.goToPage( Number(pageKey) )
          return this.currentPageDiv.children[i]
        }

        itemIdx++
      }
    }

    return null
  }

  /**
   * Navigate ItemList page items. Returns selected Element.
   * @param {Boolean} forward Navigation direction.
   * @returns {E?}
   */
  navItems(forward = true) {
    if (!this.pageContainerDiv.childElementCount) return
    
    const lastSelected = this.pageContainerDiv.querySelector('.selected')
    let toFocus = lastSelected

    // no selection, focus first-item:first-page or last-item:last-page 
    if (!toFocus) {
      const pages = this.pageContainerDiv.children
      const nextPage = forward ? 0 : pages.length -1
      toFocus = forward ? pages[0].firstChild : pages[nextPage].lastChild
      this.goToPage(nextPage)
      toFocus.classList.add('selected')
      return toFocus
    }

    const toFocusInCurrentPage = this.currentPageDiv.querySelector('.selected')
    toFocus.classList.remove('selected')

    toFocus = forward ? toFocus.nextElementSibling : toFocus.previousElementSibling
    if (!toFocusInCurrentPage) {
      toFocus = forward ? this.currentPageDiv.firstChild : this.currentPageDiv.lastChild
    }

    if (!toFocus) {
      // wrap around items on single page
      if ( Object.keys(this.#virtualPages).length < 2 ) {
        const page = this.pageContainerDiv.children[0]
        toFocus = forward ? page.firstChild : page.lastChild
      } else {
        // wrap around pages
        const page = Number( lastSelected.parentElement.getAttribute('page') )

        if (forward) {
          const nextPage = this.goToPage(page + 1) // return valid adjacent reference
          toFocus = nextPage.firstChild
        } else {
          const previousPage = this.goToPage(page - 1)
          toFocus = previousPage.lastChild
        }
      }
    }
    
    toFocus.classList.add('selected')
    return toFocus
  }

  /**
   * Go to respective page and scroll ItemList item element into view. 
   * @param {HTMLElement} itemElement 
   * @param {(boolean|ScrollIntoViewOptions)} [viewOptions] ScrollIntoView options.
   */
  selectIntoFocus(itemElement, viewOptions = { block: "center" }) {
    const onFocus = this.pageContainerDiv?.querySelector('.selected')
    if (onFocus) onFocus.classList.remove('selected')

    const page = Number( itemElement.parentElement.getAttribute('page') )

    this.goToPage(page)
    itemElement.classList.add('selected')
    itemElement.scrollIntoView(viewOptions)
  }

  /**
   * Return currently selected element, if any.
   * @returns {E?}
   */
  getSelectedElement() {
    return /** @type {E?} */ (this.pageContainerDiv?.querySelector('.selected'));
  }
}

customElements.define(ItemList.tagName, ItemList)