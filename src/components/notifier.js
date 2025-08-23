// @ts-check

/**
 * Root notification container.
 */
const rootElement = /** @type {HTMLDivElement} */ (document.getElementById('notifier'));

/**
 * Existing notification channels.
 * @type {NotificationChannel[]}
 */
const channels = [];

/**
 * Currently displayed channel, if any.
 * @type {NotificationChannel?}
 */
let currentChannel;


/**
 * On-screen notification channel.
 */
export class NotificationChannel {

  /**
   * Channel container element.
   */
  #contextElement = NotificationChannel.#newContext();

  constructor() {
    channels.push(this);
  }

  /**
   * Create a new notification context.
   */
  static #newContext() {
    const context = document.createElement('div');
    context.className = 'tabContext';
    rootElement.appendChild(context);

    return context;
  }

  /**
   * Set channel visibility.
   * @param {boolean} show Either to show or hide channel.
   */
  #showChannel(show) {
    this.#contextElement.toggleAttribute('active', show);
  }

  /**
   * Display channel while hiding all others.
   */
  displayChannel() {
    channels.forEach( channel => channel.#showChannel(false) );

    this.#showChannel(true);
    currentChannel = this;
  }

  /**
   * Display on-screen message.
   * @param {string} message Message to display.
   * @param {string} [typeId] Identifier avoid duplicates.
   */
  notify(message, typeId) {
    const double = this.#contextElement
      .querySelector(`[type-id="${typeId}"]`);

    // recycle matching typeId notification
    if (double != null) {
      // reset fade-out life cycle, bounce.
      // catch rare animation finished before currentTime reset
      try {
        double.getAnimations()[0].currentTime = 0;
        double.textContent = message;

        double.animate(
          [{ scale: 1.1 }, { scale: .9 }, { scale: 1 }],
          { duration: 150 }
        );

        return;
      } catch { /* proceed to outer scope */ }
    }

    // create notification element
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;

    if (typeId != null)
      notification.setAttribute('type-id', typeId);

    // pop-in
    notification.animate(
      [{ scale: 0 }, { scale: .9 }, { scale: 1 }],
      { duration: 150 }
    );

    // fade-out life cycle
    notification.animate(
      [{ opacity: 1 }, { opacity: 1 }, { opacity: 1 }, 
      { opacity: 0 }], { duration: 2500 }
    ).onfinish = () => {
      notification.remove();
    };

    const firstChild = this.#contextElement.firstChild;
    if (firstChild != null)
      firstChild.before(notification);
    else
      this.#contextElement.appendChild(notification);
  }

  /**
   * Clear notification channel.
   */
  close() {
    const idx = channels.indexOf(this);
    channels.splice(idx, 1);

    if (currentChannel === this)
      currentChannel = null;

    this.#contextElement.remove();
  }
}


/**
 * Display on-screen message in the current context.
 * @param {string} message Message to display.
 * @param {string} [typeId] Identifier avoid duplicates.
 */
export function notify(message, typeId) {
  currentChannel?.notify(message, typeId);
}
