/**
 * @typedef Action
 * @property {String} desc Action description.
 * @property {(...args:string[])=>void} run Main procedure.
 * @property {(lastArg:string, allArgs:string[])=>(string[]|*[])} [options] Optional hints.
 * @property {(query:string)=>(lastArg:string)=>boolean} [customFilter] Optional custom hint filter.
 * @property {Object<string, Action>} [methods] Optional methods for action.
 */

/**
 * @typedef {Object<string, Action>} ActionSet
 */


/**
 * Actions for a given component.
 */
export class ComponentActions {

  /**
   * Collection of actions per component.
   * @type {ActionSet}
   */
  #actionSet = {};

  /**
   * @param {ActionSet} actions
   */
  constructor(actions = {}) {
    this.#actionSet = actions;
  }

  /**
   * Extend action entries for polymorphism.
   * @param {ActionSet} actions Accelerator properties to overwrite.
   */
  extend(actions) {
    Object.assign(this.#actionSet, actions);
  }

  /**
   * Get action set object.
   * @returns {ActionSet}
   */
  asObject() {
    return this.#actionSet;
  }

  /**
   * Run action or method. Return true on successful call.
   * @param {String[]} cmdArgs Action and arguments.
   * @returns {Boolean} Either the corresponding action was called.
   */
  run(cmdArgs) {
    const [cmd, ...args] = cmdArgs;
    const action = this.#actionSet[cmd];

    if (!action)
      return false;

    // run action or method
    if (action.methods != null && action.methods[args[0]])
      action.methods[args[0]].run(...args.slice(1));
    else
      action.run(...args);

    return true;
  }
}
