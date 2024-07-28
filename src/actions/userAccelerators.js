import { GenericStorage } from '../components/genericStorage.js';
import { AcceleratorService } from './acceleratorService.js';
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

  static {
    elecAPI.onBroadcast( (e, message, ...args) => {
      if (message === 'accel:sync') {
        console.log('MXIV::broadcast: accel:sync');
        UserAccelerators.reload();
      }
    });
  }

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
      AcceleratorService.setBaseCustoms(accelerators);
    else
      AcceleratorService.setComponentCustoms(component, accelerators);

    if (store) {
      this.#storage.set(component, accelerators);
      elecAPI.broadcast('accel:sync');
    }
    
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
    const baseAccelSet = AcceleratorService.getAccelerators('base');
    if (baseAccelSet == null) return;
    
    // get keycombo for the first intersecting action
    const action = ['cli', 'show'];
    const keycombo = baseAccelSet.byAction(action)?.at(0) || '???';
    
    document.documentElement.style.setProperty('--msg-cliAccel', `"${keycombo}"`);
  }
}
