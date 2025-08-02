// @ts-check

/**
 * @typedef {{name:string, desc:string}} DetailedHint
 */

/**
 * @typedef {(string|DetailedHint)[]} Options
 */

/**
 * @typedef Action
 * @property {string} desc Action description.
 * @property {(...args:string[])=>void} run Main procedure.
 * @property {(lastArg:string, allArgs:string[])=>Options|Promise<Options>} [options] Optional hints.
 * @property {(query:string)=>(lastArg:string)=>boolean} [customFilter] Optional custom hint filter.
 */

/**
 * @typedef Group
 * @property {string} desc Group description.
 * @property {Object<string, Action>} actions Group actions.
 */

/**
 * @typedef {Object<string, Action|Group>} ActionSet
 */


/**
 * Actions for a given component.
 */
export class ComponentActions {

  /**
   * Component actions, groups.
   * @type {ActionSet}
   */
  #actionSet = {};

  /**
   * Actions organized by group.
   * @type {Map<string, Group>}
   */
  #groups = new Map();

  /**
   * Actions, including group actions ('group action').
   * @type {Map<string, Action>}
   */
  #actions = new Map();

  /**
   * @param {ActionSet} actions
   */
  constructor(actions = {}) {
    this.#actionSet = actions;
    this.#buildActionMaps();
  }

  /**
   * Build updated map objects from component's ActionSet.
   */
  #buildActionMaps() {
    this.#groups.clear();
    this.#actions.clear();

    for ( const [key, entry] of Object.entries(this.#actionSet) ) {
      if (entry['actions'] == null)
        this.#actions.set(key, /** @type Action */ (entry) );
      else {
        this.#groups.set(key, /** @type Group */ (entry) );

        Object.entries( /** @type Group */ (entry).actions )
          .forEach( ([name, action]) => this.#actions.set(`${key} ${name}`, action));
      }
    }
  }

  /**
   * Component group map object.
   */
  getGroups() {
    return this.#groups;
  }

  /**
   * Component action map object.
   */
  getActions() {
    return this.#actions;
  }

  /**
   * Merge action entries for polymorphism.
   * @param {ActionSet} actions Actions to merge or overwrite.
   */
  merge(actions) {
    Object.assign(this.#actionSet, actions);
    this.#buildActionMaps();
  }

  /**
   * Get action set object.
   * @returns {ActionSet}
   */
  asObject() {
    return this.#actionSet;
  }

  /**
   * Run action. Return true on successful call.
   * @param {string[]} cmdArgs Action and arguments.
   * @returns {boolean} Either the corresponding action was called.
   */
  run(cmdArgs) {
    const [cmd, ...args] = cmdArgs;

    let action = this.#groups.has(cmd)
      ? this.#actions.get(`${cmd} ${args.shift()}`)
      : this.#actions.get(cmd);

    if (action == null)
      return false;

    action.run(...args);
    return true;
  }
}
