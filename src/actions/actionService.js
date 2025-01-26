import { FRAME } from "../tabs/tab.js";
import { ComponentActions } from "./componentActions.js";


/** 
 * @typedef {import("./componentActions.js").ActionSet} ActionSet
 */


/**
 * Manages actions for multiple components.
 */
export const actionService = new class {

  /**
   * Collection of component actions.
   * @type {Object<string, ComponentActions>}
   */
  #collection = {};

  /**
   * Composable components (non-meta).
   * @type {Set<String>}
   */
  #components = new Set();

  /**
   * Set common base actions.
   * @param {ActionSet} actions Action set.
   */
  setBaseActions(actions) {
    this.#collection['base'] = new ComponentActions(actions);
    
    this.#components.forEach(component => {
      this.#buildComposedActions(component);
    });
  }

  /**
   * Set component actions.
   * @param {String} component Component name.
   * @param {ActionSet} actions Component actions.
   */
  setComponentActions(component, actions) {
    this.#components.add(component);

    this.#collection[component] = new ComponentActions(actions);
    this.#buildComposedActions(component);
  }

  /**
   * Builds composed component actions.
   * @param {String} component Component name.
   */
  #buildComposedActions(component) {
    const composedActions = new ComponentActions();
    const baseActionSet = this.#collection['base']?.asObject() || {};

    composedActions.merge(baseActionSet);
    composedActions.merge( this.#collection[component].asObject() );

    this.#collection[`${component}-all`] = composedActions;
  }

  /**
   * Returns component actions.
   * @param {String} component Component name.
   * @returns {ComponentActions}
   */
  getActions(component) {
    return this.#collection[`${component}-all`];
  }

  /**
   * Returns current FRAME Actions.
   * @returns {ComponentActions} 
   */
  get currentFrameActions() {
    if (!FRAME) return this.#collection['base'];
    return this.#collection[`${FRAME.type}-all`];
  }
}
