// @ts-check
import { FRAME } from "../tabs/tab.js";
import { ComponentActions } from "./componentActions.js";


/** 
 * @import { ActionSet } from "./componentActions.js"
 */


/**
 * Collection of component actions.
 * @type {Object<string, ComponentActions>}
 */
const collection = {};

/**
 * Non-base components.
 * @type {Set<string>}
 */
const components = new Set();


/**
 * Set common base actions.
 * @param {ActionSet} actions Action set.
 */
export function setBaseActions(actions) {
  collection['base'] = new ComponentActions(actions);

  for (const component of components)
    buildComposedActions(component); // propagate changes
}

/**
 * Set component actions.
 * @param {string} component Component name.
 * @param {ActionSet} actions Component actions.
 */
export function setComponentActions(component, actions) {
  components.add(component);

  collection[component] = new ComponentActions(actions);
  buildComposedActions(component);
}

/**
 * Builds composed component actions.
 * @param {string} component Component name.
 */
function buildComposedActions(component) {
  const composedActions = new ComponentActions();
  const baseActionSet = collection['base']?.asObject() || {};

  composedActions.merge(baseActionSet);
  composedActions.merge( collection[component].asObject() );

  collection[`${component}-all`] = composedActions;
}

/**
 * Returns component actions.
 * @param {string} component Component name.
 * @returns {ComponentActions}
 */
export function getActions(component) {
  return collection[`${component}-all`];
}

/**
 * Returns current FRAME Actions.
 * @returns {ComponentActions} 
 */
export function getCurrentActions() {
  return FRAME == null
    ? collection['base']
    : collection[`${FRAME.type}-all`];
}
