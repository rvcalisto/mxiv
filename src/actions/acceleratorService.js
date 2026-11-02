import { ComponentAccelerators } from "./componentAccelerators.js";
import { FRAME } from "../tabs/tab.js";


/**
 * @import { AcceleratorSet } from "./componentAccelerators.js"
 */


/**
 * Registered ComponentAccelerators.
 * @type {Object<string, ComponentAccelerators>}
 */
const registeredAccelerators = {};

/**
 * Registered custom ComponentAccelerators overlays.
 * @type {Object<string, ComponentAccelerators>}
 */
const customAccelerators = {};

/**
 * Composed ComponentAccelerators for each registered component.
 * @type {Object<string, ComponentAccelerators>}
 */
const composedAccelerators = {};

/**
 * Non-base components.
 * @type {Set<string>}
 */
const components = new Set();


/**
 * Set common base accelerators.
 * @param {AcceleratorSet} accelerators Accelerator set.
 */
export function setBaseAccelerators(accelerators) {
  registeredAccelerators['base'] = new ComponentAccelerators(accelerators);
  buildComposedAccelerators('base');

  for (const component of components)
    buildComposedAccelerators(component); // propagate changes
}

/**
 * Extends common base accelerators with user-defined ones. 
 * @param {AcceleratorSet} accelerators Accelerator set.
 */
export function setBaseUserAccelerators(accelerators) {
  customAccelerators['base'] = new ComponentAccelerators(accelerators);
  buildComposedAccelerators('base');

  for (const component of components)
    buildComposedAccelerators(component); // propagate changes
}

/**
 * Set component default accelerators.
 * @param {string} component Component name.
 * @param {AcceleratorSet} accelerators Accelerator set.
 */
export function setComponentAccelerators(component, accelerators) {
  components.add(component);

  registeredAccelerators[component] = new ComponentAccelerators(accelerators);
  buildComposedAccelerators(component);
}

/**
 * Extends component default accelerators with user-defined ones.
 * @param {string} component Component name.
 * @param {AcceleratorSet} accelerators Accelerator set.
 */
export function setComponentUserAccelerators(component, accelerators) {
  customAccelerators[component] = new ComponentAccelerators(accelerators);
  buildComposedAccelerators(component);
}

/**
 * Builds composed component accelerators.
 * @param {string} component Component name.
 */
function buildComposedAccelerators(component) {
  const accelerators = new ComponentAccelerators();

  if (component !== 'base') 
    accelerators.merge( composedAccelerators['base']?.asObject() || {}, false );

  accelerators.merge( registeredAccelerators[component]?.asObject() || {}, false );
  accelerators.merge( customAccelerators[component]?.asObject() || {} );

  composedAccelerators[component] = accelerators;
}

/**
 * Returns component accelerators.
 * @param {string} component Component name.
 * @param {'default'|'custom'|'composed'} [type='composed'] Layer, `composed` by default.
 * @returns {ComponentAccelerators | undefined}
 */
export function getAccelerators(component, type = 'composed') {
  if (type === 'default')
    return registeredAccelerators[component];
  if (type === 'custom')
    return customAccelerators[component];
  else
    return composedAccelerators[component];
}

/**
 * Returns current FRAME Accelerators.
 * @returns {ComponentAccelerators}
 */
export function getCurrentAccelerators() {
  return FRAME == null
    ? registeredAccelerators['base']
    : composedAccelerators[FRAME.type];
}
