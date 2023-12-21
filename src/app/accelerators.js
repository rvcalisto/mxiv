/**
 * @typedef {Object.<string, string[]>} AcceleratorSet
 */

/**
 * Accelerators for a given component.
 */
export class Accelerators {

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
    let treatedKey = key.toLowerCase();

    // translate aliased keys
    treatedKey = treatedKey.replace('space', ' ');

    // set key in predefined order to avoid multiple entries for same combo
    if (treatedKey.includes('+')) {
      const hasShift = treatedKey.includes('shift');
      const hasCtrl = treatedKey.includes('control');

      // re-assemble combo in predefined order [key+Shift+Control]
      treatedKey = treatedKey
        .replaceAll('+', '').replace('shift', '').replace('control', '');
      if (hasShift) treatedKey += '+shift';
      if (hasCtrl) treatedKey += '+control';
    }

    return treatedKey;
  }

  /**
   * Extend accelerator entries for polymorphism.
   * @param {AcceleratorSet} accelerators Accelerator properties to overwrite.
   * @param {true} deleteEmpty Delete keys whose value is an empty array.
   */
  extend(accelerators, deleteEmpty = true) {
    for (const [key, value] of Object.entries(accelerators)) {
      let treatedKey = Accelerators.parseKeycombo(key);

      if (deleteEmpty && value.length < 1) delete this.#byKeycombo[treatedKey];
      else this.#byKeycombo[treatedKey] = value;
    }

    this.#buildAcceleratedActions();
  }

  /**
   * Get accelerator key-value object.
   * @returns {AcceleratorSet}
   */
  asObject() {
    return this.#byKeycombo;
  }

  /**
   * Builds a relation of actions and accelerating keyCombos.
   */
  #buildAcceleratedActions() {
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
    const singleKey = keycombo.split('+')[0]; // knowing first idx will be key
    return singleKey === keyEvent.key.toLowerCase();
  }

  /**
   * Returns action and arguments accelerated by given event. null otherwise.
   * @param {KeyboardEvent} keyEvent Raw `KeyboardEvent` to match accelerators.
   * @returns {String[]?}
   */
  byEvent(keyEvent) {
    for (const keyCombo in this.#byKeycombo) {
      if (Accelerators.#matchEvent(keyCombo, keyEvent))
        return this.#byKeycombo[keyCombo];
    }
    return null;
  }

  /**
   * Return an array of keycombos accelarating a given action.
   * @param {String[]} actions Command strings accelerated by keys.
   * @param {false} exact Either to include all intersecting actions or exact matches only.
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
