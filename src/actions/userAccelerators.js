// @ts-check
import { GenericStorage } from '../components/genericStorage.js';
import * as acceleratorService from './acceleratorService.js';
import { ComponentAccelerators } from "./componentAccelerators.js";


/**
 * @import { AcceleratorSet } from "./componentAccelerators.js"
 */


/**
 * User accelerator storage.
 * @type {GenericStorage<AcceleratorSet>}
 */
const storage = new GenericStorage('userAccelerators');


/**
 * Get user-defined accelerator set for component.
 * @returns {AcceleratorSet} 
 */
export function getUserAccelerators(component = 'base') {
  const accelerators = storage.get(component) || {};
  return new ComponentAccelerators(accelerators).asObject();
}

/**
 * Update user accelerators for component. Persist changes by default.
 * - Entries whose value's first item equals `default` are deleted.
 * - Entries whose value's first item equals `mask` are nulled.
 * @param {string} component Component to modify.
 * @param {AcceleratorSet} acceleratorSet User defined accelerators.
 * @param {boolean} [store=true] Either to persist changes after apply.
 */
export function setUserAccelerators(component, acceleratorSet, store = true) {
  const accelerators = storage.get(component) || {};

  // delete keys purposefully nulled before assignment & storing
  // otherwise, overwrite key value
  for ( const [key, actionArr] of Object.entries(acceleratorSet) ) {
    const treatedKey = ComponentAccelerators.parseKeycombo(key);
    const toDelete = actionArr[0] === 'default';
    const toMask = actionArr[0] === 'mask';

    if (toDelete)
      delete accelerators[treatedKey];
    else
      accelerators[treatedKey] = toMask ? [] : actionArr;
  }

  if (component === 'base')
    acceleratorService.setBaseUserAccelerators(accelerators);
  else
    acceleratorService.setComponentUserAccelerators(component, accelerators);

  if (store) {
    storage.set(component, accelerators);
    elecAPI.broadcast('accel:sync');
  }

  updateActionPaletteAcceleratorCSSvar();
}

/**
 * (Re)Apply previously stored user accelerators for every component.
 */
export function reloadUserAccelerators() {
  const entries = storage.entries();

  // no user accelerators to apply, generate CSS var only
  if (entries.length < 1)
    return updateActionPaletteAcceleratorCSSvar();

  for (const [component, accelerators] of entries) {
    if ( Object.keys(accelerators).length > 0 )
      setUserAccelerators(component, accelerators, false);
  }
}

/**
 * Update `--txt-actPaletteAccel` CSS variable value with first 
 * found keycombo accelerating the `cli show` base action.
 * - This is then displayed in `Viewer` to conduct new users to the action palette.
 * - Elements using CSS variables in their style get updated automatically on change.
 */
function updateActionPaletteAcceleratorCSSvar() {
  const baseAccelSet = acceleratorService.getAccelerators('base');

  if (baseAccelSet != null) {
    // get keycombo for the first intersecting action
    const action = ['palette', 'show'];
    const keycombo = baseAccelSet.byAction(action)?.at(0) || '???';

    document.documentElement.style.setProperty('--txt-actPaletteAccel', `"${keycombo}"`);
  }
}


/**
 * Reload accelerators on broadcast.
 */
function initialize() {
  elecAPI.onBroadcast((/** @type string */ message) => {
    if (message === 'accel:sync') {
      console.log('MXIV::broadcast: accel:sync');
      reloadUserAccelerators();
    }
  });
}

initialize();
