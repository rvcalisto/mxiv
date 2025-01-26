/**
 * In-app notification methods.
 */
export const appNotifier = new class {

  #rootElement = /** @type {HTMLElement} */ (document.getElementById('appNotifier'));

  /**
   * Display message on screen.
   * @param {String} message Message to display.
   * @param {String} [typeId] Identifier avoid duplicates.
   */
  notify(message, typeId) {

    // recycle notification element for if typeId attribute matches
    const element = this.#rootElement.querySelector(`[type-id="${typeId}"]`);
    if (element != null) {
      element.textContent = message;
      
      // reset fade-out life cycle, bounce
      element.getAnimations()[0].currentTime = 0;
      element.animate([
        { scale: 1.1 }, { scale: .9 }, { scale: 1 }],
        { duration: 150 });

      return;
    }

    // create notification element
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    if (typeId != null)
      notification.setAttribute('type-id', typeId);

    // pop-in
    notification.animate([
      { scale: 0 }, { scale: .9 }, { scale: 1 }],
      { duration: 150 });

    // fade-out life cycle
    notification.animate([
      { opacity: 1 }, { opacity: 1 },
      { opacity: 1 }, { opacity: 0 }
      ], { duration: 2500 })
      .onfinish = () => {
        notification.remove();
      }

    const firstChild = this.#rootElement.firstChild;
    if (firstChild) firstChild.before(notification);
    else this.#rootElement.appendChild(notification);
  }
}
