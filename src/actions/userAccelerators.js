import { GenericStorage } from '../components/genericStorage.js';
import { AcceleratorController } from './acceleratorController.js';
import { ComponentAccelerators } from "./componentAccelerators.js";


/**
 * @typedef {import('./componentAccelerators.js').AcceleratorSet} AcceleratorSet
 */


/**
 * Persist, apply and update user-defined accelerators.
 */
export const UserAccelerators = new class {

  /**
   * @type {GenericStorage<AcceleratorSet>}
   */
  #storage = new GenericStorage('userHotkeys');

  /**
   * Get user-defined accelerator set for component.
   * @returns {AcceleratorSet} 
   */
  getAcceleratorSet(component = 'base') {
    const accelerators = this.#storage.get(component);

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
    const accelerators = this.#storage.get(component) || {};
    
    // delete keys purposefully nulled before assignment & storing
    // otherwise, overwrite key value
    for ( let [key, actionArr] of Object.entries(acceleratorSet) ) {
      key = ComponentAccelerators.parseKeycombo(key);
      const toDelete = actionArr[0] === 'default';
      const toMask = actionArr[0] === 'mask';

      if (toDelete) delete accelerators[key];
      else accelerators[key] = toMask ? [] : actionArr;
    }

    if (component === 'base')
      AcceleratorController.setBaseCustoms(accelerators);
    else
      AcceleratorController.setComponentCustoms(component, accelerators);

    if (store) this.#storage.set(component, accelerators);
    
    this.#updateCLIaccelCSSvar();
  }

  /**
   * (Re)Apply previously stored user accelerators for every component.
   */
  reload() {
    const entries = this.#storage.entries();

    // no user accelerators to apply, generate CSS var only
    if ( entries.length < 1 ) return this.#updateCLIaccelCSSvar();

    for (const [component, accelerators] of entries) {
      if ( Object.keys(accelerators).length > 0 )
        this.set(component, accelerators, false);
    }
  }

  /**
   * Update `--msg-cliAccel` CSS variable value with first 
   * found keycombo accelerating the `cli show` base action.
   * - This is then displayed in `Viewer` to conduct new users to the CLI accelerator.
   * - Elements using CSS variables in their style get updated automatically on change.
   */
  #updateCLIaccelCSSvar() {
    const baseAccelSet = AcceleratorController.getAccelerators('base');
    if (baseAccelSet == null) return;
    
    // try keycombo for specific action, otherwise any intersection
    const action = ['cli', 'show'];
    const keycombo = baseAccelSet.byAction(action, true)[0] ||
      baseAccelSet.byAction(action)[0] || '???';
    
    document.documentElement.style.setProperty('--msg-cliAccel', `"${keycombo}"`);
  }
}
