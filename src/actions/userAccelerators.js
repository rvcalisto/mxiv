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
  #storage = new GenericStorage('userAccelerators');

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
    
    this.#updateActionPaletteAcceleratorCSSvar();
  }

  /**
   * (Re)Apply previously stored user accelerators for every component.
   */
  reload() {
    const entries = this.#storage.entries();

    // no user accelerators to apply, generate CSS var only
    if ( entries.length < 1 ) return this.#updateActionPaletteAcceleratorCSSvar();

    for (const [component, accelerators] of entries) {
      if ( Object.keys(accelerators).length > 0 )
        this.set(component, accelerators, false);
    }
  }

  /**
   * Update `--txt-actPaletteAccel` CSS variable value with first 
   * found keycombo accelerating the `cli show` base action.
   * - This is then displayed in `Viewer` to conduct new users to the action palette.
   * - Elements using CSS variables in their style get updated automatically on change.
   */
  #updateActionPaletteAcceleratorCSSvar() {
    const baseAccelSet = AcceleratorService.getAccelerators('base');
    if (baseAccelSet == null) return;
    
    // get keycombo for the first intersecting action
    const action = ['palette', 'show'];
    const keycombo = baseAccelSet.byAction(action)?.at(0) || '???';
    
    document.documentElement.style.setProperty('--txt-actPaletteAccel', `"${keycombo}"`);
  }
}

/**
 * Migrate 'userHotkeys' storage to 'userAccelerators' if empty.
 * Replace 'cli' with 'palette'.
 * TODO: Remove later.
 */
function cliToPalette() {
  /** @type {GenericStorage<AcceleratorSet>}*/
  const userAccelerators = new GenericStorage('userAccelerators');

  if (userAccelerators.entries().length > 0)
    return;
  
  /** @type {GenericStorage<AcceleratorSet>}*/
  const userHotkeys = new GenericStorage('userHotkeys');
  
  for ( const [component, hotkeys] of userHotkeys.entries() ) {
    const accelerators = {};
    
    Object.entries(hotkeys).forEach(([key, action]) => {
      if (action.length > 0)
        action[0] = action[0].replace('cli', 'palette');
      
      accelerators[key] = action;
    });
    
    userAccelerators.set(component, accelerators);
  }
  
  console.log('migrated "cli" to "palette"');
}

cliToPalette();
