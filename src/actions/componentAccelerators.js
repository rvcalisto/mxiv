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
   * Builds a relation of action slices and accelerating keyCombos.
   */
  #buildAcceleratedActions() {
    this.#byAction = {};

    for ( const [keyCombo, action] of Object.entries(this.#byKeycombo) ) {

      for (let i = 1; i <= action.length; i++) {
        const actionSlice = String( action.slice(0, i) );

        if (this.#byAction[actionSlice] == null)
          this.#byAction[actionSlice] = [];

        this.#byAction[actionSlice].push(keyCombo);
      }
    }
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
   * @returns {String[]}
   */
  byAction(actions) {
    return this.#byAction[String(actions)] || [];
  }
}
