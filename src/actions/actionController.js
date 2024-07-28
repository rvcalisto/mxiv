import { FRAME } from "../tabs/tab.js";
import { ComponentActions } from "./componentActions.js";


/** 
 * @typedef {import("./componentActions.js").ActionSet} ActionSet
 */


/**
 * Manage actions for a multitude of registered components.
 */
export const ActionController = new class {

  /**
   * Collection of actions per component.
   * @type {Object<string, ComponentActions>}
   */
  #collection = {};

  /**
   * @type {Set<String>}
   */
  #registeredComponents = new Set();

  /**
   * Get component Actions as object. Returns empty object if not stored. 
   * @param {String} component Component name.
   * @returns {ActionSet}
   */
  #getActionsObject(component) {
    try {
      return this.#collection[component].asObject();
    } catch {
      return {};
    }
  }

  /**
   * Set base actions to be inherited by other components.
   * @param {ActionSet} actions 
   */
  setBaseActions(actions) {
    this.#collection['base'] = new ComponentActions(actions);
    this.#propagateBaseChanges();
  }

  /**
   * Set actions for component.
   * @param {String} component Component name.
   * @param {ActionSet} actions Component actions.
   */
  setComponentActions(component, actions) {
    this.#registeredComponents.add(component);

    this.#collection[component] = new ComponentActions(actions);
    this.#setComponentComposed(component);
  }

  /**
   * Creates new action object inheriting base for a given component.
   * @param {String} component 
   */
  #setComponentComposed(component) {
    const composedActions = new ComponentActions();

    composedActions.merge( this.#getActionsObject('base') );
    composedActions.merge( this.#collection[component].asObject() );

    this.#collection[`${component}-all`] = composedActions;
  }

  /**
   * (Re)Creates composed actions for every registered component. 
   */
  #propagateBaseChanges() {
    const registeredComponentes = this.#registeredComponents.values();

    for (const component of registeredComponentes) {
      this.#setComponentComposed(component);
    }
  }

  /**
   * Get component actions.
   * @param {String} component Component from which to retrieve actions.
   * @returns {ComponentActions}
   */
  getActions(component) {
    return this.#collection[`${component}-all`];
  }

  /**
   * Return Actions for current FRAME.
   * @returns {ComponentActions} 
   */
  get currentFrameActions() {
    if (!FRAME) return this.#collection['base-all']
    return this.#collection[`${FRAME.type}-all`];
  }
}