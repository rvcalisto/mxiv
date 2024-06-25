import { AcceleratorController } from './acceleratorController.js';
import { ComponentAccelerators } from "./componentAccelerators.js";


/**
 * Persist, apply and update user-defined accelerators.
 */
export const UserAccelerators = new class {

  /**
   * LocalStorage key name.
   */
  #storageEntry = 'userHotkeys';

  /**
   * @typedef {import('./componentAccelerators.js').AcceleratorSet} AcceleratorSet
   * @typedef {Object<string, AcceleratorSet>} UserAccelerators
   */

  /**
   * Get stored user accelerators collection object from localStorage.
   * @returns {UserAccelerators}
   */
  #getStorageObj() {
    const userAcceleratorsJSON = localStorage.getItem(this.#storageEntry);
    return userAcceleratorsJSON ? JSON.parse(userAcceleratorsJSON) : {};
  }

  /**
   * Store user accelerators collection object into localStorage.
   * @param {UserAccelerators} userAccelerators Profile object.
   */
  #setStorageObj(userAccelerators) {
    localStorage.setItem( this.#storageEntry, JSON.stringify(userAccelerators) );
  }

  /**
   * Get user-defined accelerator set for component.
   * @returns {AcceleratorSet} 
   */
  getAcceleratorSet(component = 'base') {
    const userAccelerators = this.#getStorageObj();
    const accelerators = userAccelerators[component];

    return new ComponentAccelerators( accelerators || {} ).asObject();
  }

  /**
   * Update user accelerators for component. Persist changes by default.
   * - Entries whose value's first item equals `default` are deleted.
   * - Entries whose value's first item equals `mask` are nulled.
   * @param {string} component Component to modify.
   * @param {AcceleratorSet} acceleratorSet User defined accelerators.
   * @param {boolean} [store=true] Either to persist changes after apply.
   */
  set(component, acceleratorSet, store = true) {
    const userAccelerators = this.#getStorageObj();
    if (!userAccelerators[component]) userAccelerators[component] = {};
    
    // delete keys purposefully nulled before assignment & storing
    // otherwise, overwrite key value
    for ( let [key, actionArr] of Object.entries(acceleratorSet) ) {
      key = ComponentAccelerators.parseKeycombo(key);
      const toDelete = actionArr[0] === 'default';
      const toMask = actionArr[0] === 'mask';

      if (toDelete) delete userAccelerators[component][key];
      else userAccelerators[component][key] = toMask ? [] : actionArr;
    }

    if (component === 'base')
      AcceleratorController.setBaseCustoms(userAccelerators[component]);
    else
      AcceleratorController.setComponentCustoms(component, userAccelerators[component]);

    if (store) this.#setStorageObj(userAccelerators);
    
    this.#updateCLIaccelCSSvar();
  }

  /**
   * (Re)Apply previously stored user accelerators for every component.
   */
  reload() {
    const userAccelerators = this.#getStorageObj();

    // no user accelerators to apply, generate CSS var only
    if ( Object.keys(userAccelerators).length < 1 ) return this.#updateCLIaccelCSSvar();

    for (const component in userAccelerators) {
      const acceleratorSet = userAccelerators[component];
      if ( !Object.keys(acceleratorSet).length ) continue;
      
      this.set(component, acceleratorSet, false);
    }
  }

  /**
   * Update `--msg-cliAccel` CSS variable value with first 
   * found keycombo accelerating the `cli show` base action.
   * - This is then displayed in `Viewer` to conduct new users to the CLI accelerator.
   * - Elements using CSS variables in their style get updated automatically on change.
   */
  #updateCLIaccelCSSvar() {
    const action = ['cli', 'show'];
    
    // try keycombo for specific action, otherwise any intersection
    const baseAccelSet = AcceleratorController.getAccelerators('base');

    if (baseAccelSet != null) {
      const keycombo = baseAccelSet.byAction(action, true)[0] ||
      baseAccelSet.byAction(action)[0] || '???';
      document.documentElement.style.setProperty('--msg-cliAccel', `"${keycombo}"`);
    }
  }
}