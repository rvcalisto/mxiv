// @ts-check
import { ComponentAccelerators } from "./componentAccelerators.js";
import { FRAME } from "../tabs/tab.js";


/**
 * @import { AcceleratorSet } from "./componentAccelerators.js"
 */


/**
 * Collection of component accelerators.
 * @type {Object<string, ComponentAccelerators>}
 */
const collection = {};

/**
 * Non-base components.
 * @type {Set<string>}
 */
const components = new Set();


/**
 * Returns component AcceleratorSet. Empty if not stored.
 * @param {string} component Component name.
 * @returns {AcceleratorSet}
 */
function getSet(component) {
  return collection[component]?.asObject() || {};
}

/**
 * Set common base accelerators.
 * @param {AcceleratorSet} accelerators Accelerator set.
 */
export function setBaseAccelerators(accelerators) {
  collection['base'] = new ComponentAccelerators(accelerators);
  buildComposedAccelerators('base');

  for (const component of components)
    buildComposedAccelerators(component); // propagate changes
}

/**
 * Extends common base accelerators with user-defined ones. 
 * @param {AcceleratorSet} accelerators Accelerator set.
 */
export function setBaseUserAccelerators(accelerators) {
  collection['base-user'] = new ComponentAccelerators(accelerators);
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

  collection[component] = new ComponentAccelerators(accelerators);
  buildComposedAccelerators(component);
}

/**
 * Extends component default accelerators with user-defined ones.
 * @param {string} component Component name.
 * @param {AcceleratorSet} accelerators Accelerator set.
 */
export function setComponentUserAccelerators(component, accelerators) {
  collection[`${component}-user`] = new ComponentAccelerators(accelerators);
  buildComposedAccelerators(component);
}

/**
 * Builds composed component accelerators.
 * @param {string} component Component name.
 */
function buildComposedAccelerators(component) {
  const composedAccelerators = new ComponentAccelerators();

  if (component !== 'base') 
    composedAccelerators.merge( getSet('base-all'), false );

  composedAccelerators.merge( collection[component].asObject(), false );
  composedAccelerators.merge( getSet(`${component}-user`) );

  collection[`${component}-all`] = composedAccelerators;
}

/**
 * Returns component accelerators.
 * @param {string} component Component name.
 * @param {'composed'|'default'|'user'} [type='composed'] Layer, `composed` by default.
 * @returns {ComponentAccelerators?}
 */
export function getAccelerators(component, type = 'composed') {
  if (type === 'composed')
    return collection[`${component}-all`];
  else if (type === 'default')
    return collection[component];
  else
    return collection[`${component}-user`];
}

/**
 * Returns current FRAME Accelerators.
 * @returns {ComponentAccelerators}
 */
export function getCurrentAccelerators() {
  return FRAME == null
    ? collection['base-all']
    : collection[`${FRAME.type}-all`];
}
