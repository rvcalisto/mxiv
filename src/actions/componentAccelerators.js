/**
 * @typedef {Object<string, string[]>} AcceleratorSet
 */


/**
 * Accelerators for a given component.
 */
export class ComponentAccelerators {

  /**
   * Keycombo keys, action & args as values.
   * @type {AcceleratorSet}
   */
  #byKeycombo = {};

  /**
   * Action keys, keycombo as values.
   * @type {AcceleratorSet}
   */
  #byAction = {};

  /**
   * @param {AcceleratorSet} accelerators
   */
  constructor(accelerators = {}) {
    this.extend(accelerators, false);
    this.#buildAcceleratedActions();
  }

  /**
   * Treats keycombo as to make it an unique key.
   * @param {String} key Keycombo to be treated.
   * @return {String} Parsed unique accelerator.
   */
  static parseKeycombo(key) {
    key = key.toLowerCase();
    let modifiers = '';

    // rip modifier concatenations into ordered string
    if ( key.includes('+') ) {
      for (const modifier of ['control', 'shift']) {
        if ( !key.includes(modifier) ) continue 
        
        modifiers += `${modifier}+`;
        key = key.replace(modifier, '');
      }

      key = key.replaceAll('+', '');
    }

    // translate aliased keys
    if ( key.startsWith('space') ) {
      key = key.replace('space', ' ');
    }

    return modifiers + key;
  }

  /**
   * Extend accelerator entries for polymorphism.
   * @param {AcceleratorSet} accelerators Accelerator properties to overwrite.
   * @param {boolean} [deleteEmpty=true] Delete keys whose value is an empty array.
   */
  extend(accelerators, deleteEmpty = true) {
    for (const [key, value] of Object.entries(accelerators)) {
      let treatedKey = ComponentAccelerators.parseKeycombo(key);

      if (deleteEmpty && value.length < 1) delete this.#byKeycombo[treatedKey];
      else this.#byKeycombo[treatedKey] = value;
    }

    this.#buildAcceleratedActions();
  }

  /**
   * Get accelerator set object.
   * @returns {AcceleratorSet}
   */
  asObject() {
    /** @type {AcceleratorSet} */
    const accelSetClone = {};

    // assign entries to clone while translating-back aliased keys
    for ( let [key, action] of Object.entries(this.#byKeycombo) ) {
      if ( key.startsWith(' ') ) {
        key = key.replace(' ', 'space');
      }
      
      accelSetClone[key] = action;
    }

    return accelSetClone;
  }

  /**
   * Builds a relation of actions and accelerating keyCombos.
   */
  #buildAcceleratedActions() {
    /** @type {AcceleratorSet} */
    const acceleratedCmds = {};

    for (const [accelKey, cmdArgs] of Object.entries(this.#byKeycombo)) {
      let [command, args] = cmdArgs;

      if (!acceleratedCmds[command]) acceleratedCmds[command] = [];
      acceleratedCmds[command].push(accelKey.replace(' ', 'space'));
    }

    this.#byAction = acceleratedCmds;
  }

  /**
   * Return either keycombo matches keyboard event.
   * @param {String} keycombo Sorted, ordered, lower-case key combo string.
   * @param {KeyboardEvent} keyEvent Raw `KeyboardEvent` to match against.
   * @returns {Boolean}
   */
  static #matchEvent(keycombo, keyEvent) {
    // fail if modifier keys mismatch
    if (keyEvent.shiftKey !== keycombo.includes('shift')) return false;
    if (keyEvent.ctrlKey !== keycombo.includes('control')) return false;

    // return mapped key & keyboardEvent key match
    const singleKey = keycombo.split('+').at(-1); // knowing last idx will be key
    return singleKey === keyEvent.key.toLowerCase();
  }

  /**
   * Returns action and arguments accelerated by given event. null otherwise.
   * @param {KeyboardEvent} keyEvent Raw `KeyboardEvent` to match accelerators.
   * @returns {String[]?}
   */
  byEvent(keyEvent) {
    for (const keyCombo in this.#byKeycombo) {
      if (ComponentAccelerators.#matchEvent(keyCombo, keyEvent))
        return this.#byKeycombo[keyCombo];
    }
    return null;
  }

  /**
   * Return an array of keycombos accelarating a given action.
   * @param {String[]} actions Command strings accelerated by keys.
   * @param {boolean} [exact=false] Either to include all intersecting actions or exact matches only.
   * @returns {String[]}
   */
  byAction(actions, exact = false) {
    if (actions.length < 2) return this.#byAction[actions[0]] || [];

    const componentEntries = Object.entries(this.#byKeycombo);
    const keycombos = [];
    const matchLength = actions.length;

    for (const [keycombo, cmdArgs] of componentEntries) {
      const match = exact ? String(actions) === String(cmdArgs) :
        String(actions) === String(cmdArgs.slice(0, matchLength));

      if (match) keycombos.push(keycombo);
    }

    return keycombos;
  }
}
