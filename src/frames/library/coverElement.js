/**
 * @typedef {import('../../APIs/library/libraryStorage.js').LibraryEntry} LibraryEntry
 */


/**
 * Library cover object.
 */
export class Cover extends HTMLElement {

  static tagName = 'cover-element';

  /**
   * File name.
   */
  bookName = '';

  /**
   * Absolute path to file.
   */
  bookPath = '';

  /**
   * Absolute path to cover thumbnail.
   */
  coverPath = '';

  /**
   * @type {string?} Encoded `coverPath` (for HTML `src` attribute).
   */
  coverURL = null;

  /**
   * Set behavior on 'remove' button click.
   * @type {Function?}
   */
  onClickRemove = null;

  static {
    customElements.define(Cover.tagName, Cover);
  }

  connectedCallback() {
    const title = document.createElement('p');
    title.className = 'coverTitle';
    title.textContent = this.bookName;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'coverRemoveButton';
    removeBtn.setAttribute('icon', 'close');
    removeBtn.title = 'delist book';
    removeBtn.tabIndex = -1;

    const coverURL = this.coverURL ?? '../icons/libraryIconPlaceholder.jpg';
    this.style.backgroundImage = `url(${coverURL})`;

    removeBtn.onclick = (e) => {
      e.stopImmediatePropagation();
      if (this.onClickRemove) this.onClickRemove();
    };

    this.append(title, removeBtn);
  }

  /**
   * Update cover thumbnail.
   * @param {string?} thumbnail
   */
  updateCover(thumbnail) {
    this.style.backgroundImage = `url(${
      thumbnail != null ? thumbnail : '../icons/libraryIconPlaceholder.jpg'
    })`;
  }

  /**
   * Create and return a new cover element with defined properties.
   * @param {LibraryEntry} entry
   * @return {Cover}
   */
  static from(entry) {
    const cover = /** @type {Cover} */ (document.createElement(this.tagName));

    cover.bookName = entry.name;
    cover.bookPath = entry.path;
    cover.coverPath = entry.coverPath;
    cover.coverURL = entry.coverURL;

    return cover;
  }
}
