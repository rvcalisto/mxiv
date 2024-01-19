import { FRAME } from "../tabs/tab.js"


/**
 * @typedef ActionObject
 * @property {String} desc Action description.
 * @property {(args:string[])} run Main procedure.
 * @property {(lastArg:string, allArgs:string[])=>string[]} [options] Optional hints.
 * @property {(lastArg:string)=>boolean} [customFilter] Optional custom hint filter.
 * @property {Object.<string, ActionObject>} [methods] Optional methods for action.
 */

/**
 * Actions for a given component.
 */
 class Actions {

  /**
   * Collection of actions per component.
   * @type {Object<string, ActionObject>}
   */
  #actionSet = {}

  /**
   * @param {Object<string, ActionObject>} actions 
   */
  constructor(actions = {}) {
    this.#actionSet = actions
  }

  /**
   * Extend action entries for polymorphism.
   * @param {Object<string, ActionObject>} actions Accelerator properties to overwrite.
   */
  extend(actions) {
    Object.assign(this.#actionSet, actions)
  }

  /**
   * Get actions object.
   * @param {String} component Component from which to retrieve actions.
   * @returns {Object.<string, ActionObject>}
   */
  asObject() {
    return this.#actionSet
  }

  /**
   * Run action or method. Return true on successful call.
   * @param {String[]} cmdArgs Action and arguments.
   * @returns {Boolean} Either the corresponding action was called.
   */
  run(cmdArgs) {
    const [cmd, ...args] = cmdArgs
    const action = this.#actionSet[cmd]
    if (!action) return false

    const actionIsMethod = action.methods && action.methods[args[0]]
    if (actionIsMethod) action.methods[args[0]].run(...args.slice(1))
    else action.run(...args)
    
    return true
  }
}


/**
 * Manage actions for a multitude of registered components.
 */
export const ActionDB = new class _ActionDB {

  /**
   * Collection of actions per component.
   * @type {Object<string, Actions>}
   */
  #collection = {}

  /**
   * @type {Set<String>}
   */
  #registeredComponents = new Set()

  /**
   * Get component Actions as object. Returns empty object if not stored. 
   * @param {String} component Component name.
   * @returns {Object<string, ActionObject>}
   */
  #getActionsObject(component) {
    try {
      return this.#collection[component].asObject()
    } catch {
      return {}
    }
  }

  /**
   * Set base actions to be inherited by other components.
   * @param {Object<string, ActionObject>} actions 
   */
  setBaseActions(actions) {
    this.#collection['base'] = new Actions(actions)
    this.#propagateBaseChanges()
  }

  /**
   * Set actions for component.
   * @param {String} component Component name.
   * @param {Object<string, ActionObject>} actions Component actions.
   */
  setComponentActions(component, actions) {
    this.#registeredComponents.add(component)

    this.#collection[component] = new Actions(actions)
    this.#setComponentComposed(component)
  }

  /**
   * Creates new action object inheriting base for a given component.
   * @param {String} component 
   */
  #setComponentComposed(component) {
    const composedActions = new Actions()

    composedActions.extend( this.#getActionsObject('base') )
    composedActions.extend( this.#collection[component].asObject() )

    this.#collection[`${component}-all`] = composedActions
  }

  /**
   * (Re)Creates composed actions for every registered component. 
   */
  #propagateBaseChanges() {
    const registeredComponentes = this.#registeredComponents.values()

    for (const component of registeredComponentes) {
      this.#setComponentComposed(component)
    }
  }

  /**
   * Get actions object from given component.
   * @param {String} component Component from which to retrieve actions.
   * @returns {Object.<string, ActionObject>}
   */
  getActions(component) {
    return this.#collection[`${component}-all`]
  }

  /**
   * Return Actions for current FRAME.
   * @returns {Actions} 
   */
  get currentFrameActions() {
    return this.#collection[`${FRAME.type}-all`]
  }
}