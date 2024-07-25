/**
 * @typedef {Object<string, string[]>} AcceleratorSet
 */


/**
 * Accelerators for a given component.
 */
export class ComponentAccelerators {

  /**
   * Aliased KeyboardEvent keys.
   */
  static #keyAliases = {
    ' ': 'space',
    '+': 'plus'
  };

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

    Object.assign(accelSetClone, this.#byKeycombo);

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
      acceleratedCmds[command].push(accelKey);
    }

    this.#byAction = acceleratedCmds;
  }

  /**
   * Returns action and arguments accelerated by given event. null otherwise.
   * @param {KeyboardEvent} keyEvent Raw `KeyboardEvent` to match accelerators.
   * @returns {String[]?}
   */
  byEvent(keyEvent) {
    let eventCombo = '';
    if (keyEvent.ctrlKey) eventCombo += 'control+';
    if (keyEvent.shiftKey) eventCombo += 'shift+';

    // translate aliased keys
    const key = keyEvent.key.toLowerCase();
    eventCombo += ComponentAccelerators.#keyAliases[key] || key;

    return this.#byKeycombo[eventCombo];
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
