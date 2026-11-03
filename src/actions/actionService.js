import { ComponentActions } from "./componentActions.js";


/** 
 * @import { ActionSet } from "./componentActions.js"
 */


/**
 * Registered ComponentActions.
 * @type {Object<string, ComponentActions>}
 */
const registeredActions = {};

/**
 * Composed ComponentActions for each registered component.
 * @type {Object<string, ComponentActions>}
 */
const composedActions = {};

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
  registeredActions['base'] = new ComponentActions(actions);

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

  registeredActions[component] = new ComponentActions(actions);
  buildComposedActions(component);
}

/**
 * Builds composed component actions.
 * @param {string} component Component name.
 */
function buildComposedActions(component) {
  const actions = new ComponentActions();
  const baseActionSet = registeredActions['base']?.asObject() || {};

  actions.merge(baseActionSet);
  actions.merge( registeredActions[component].asObject() );

  composedActions[component] = actions;
}

/**
 * Returns component actions.
 * @param {string} component Component name.
 * @returns {ComponentActions}
 */
export function getActions(component) {
  return composedActions[component];
}
