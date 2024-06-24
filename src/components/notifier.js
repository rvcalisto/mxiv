/**
 * In-app notification methods.
 */
export const AppNotifier = new class {

  #rootElement = document.getElementById('appNotifier')

  /**
   * Display message on screen.
   * @param {String} msg Message to display.
   * @param {String} [typeId] Identifier avoid duplicates.
   */
  notify(msg, typeId) {
    
    // update same typeId items over creating new ones
    for (const item of this.#rootElement.children) {
      if (!item.typeId || item.typeId !== typeId) continue
      item.textContent = msg
      item.getAnimations()[0].currentTime = 0

      // bounce
      item.animate([{ scale: 1.1 }, { scale: .9 }, { scale: 1 }], 
      { duration: 150 })

      return
    }
  
    const msgPanel = document.createElement('div')
    const label = document.createElement('p')
    msgPanel.className = 'notification'
    msgPanel.typeId = typeId
    label.textContent = msg
  
    msgPanel.animate([
      { opacity: 1 }, { opacity: 1 },
      { opacity: 1 }, { opacity: 0 }
    ], {
      duration: 2500
    }).onfinish = () => {
      msgPanel.remove()
    }

    // bounce
    msgPanel.animate([{ scale: 0 }, { scale: .9 }, { scale: 1 }], 
    { duration: 150 })
  
    msgPanel.appendChild(label)

    const firstChild = this.#rootElement.firstChild
    if (firstChild) firstChild.before(msgPanel)
    else this.#rootElement.appendChild(msgPanel)
  }

}