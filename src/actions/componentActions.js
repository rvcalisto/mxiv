/**
 * @typedef {{name:string, desc:string}} DetailedHint
 */

/**
 * @typedef {(string|DetailedHint)[]} Options
 */

/**
 * @template T
 * @typedef Action
 * @property {string} desc Action description.
 * @property {(instance: T, ...args:string[])=>void} run Main procedure.
 * @property {(instance: T, lastArg:string, allArgs:string[])=>Options|Promise<Options>} [options] Optional hints.
 * @property {(instance: T, query:string)=>(lastArg:string)=>boolean} [customFilter] Optional custom hint filter.
 */

/**
 * @template T
 * @typedef Group
 * @property {string} desc Group description.
 * @property {{[x: string]: Action<T>}} actions Group actions.
 */

/**
 * @template [T=any]
 * @typedef {{[x: string]: Action<T>|Group<T>}} ActionSet
 */


/**
 * @template [T=any]
 * Actions for a given component.
 */
export class ComponentActions {

  /**
   * Component actions, groups.
   * @type {ActionSet<T>}
   */
  #actionSet = {};

  /**
   * Actions organized by group.
   * @type {Map<string, Group<T>>}
   */
  #groups = new Map();

  /**
   * Actions, including group actions ('group action').
   * @type {Map<string, Action<T>>}
   */
  #actions = new Map();

  /**
   * @param {ActionSet<T>} actions
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
      const isGroup = Object.hasOwn(entry, 'actions');

      if (!isGroup)
        this.#actions.set(key, /** @type {Action<T>} */ (entry));
      else {
        this.#groups.set(key, /** @type {Group<T>} */ (entry));

        Object.entries(/** @type {Group<T>} */ (entry).actions)
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
   * @param {ActionSet<T>} actions Actions to merge or overwrite.
   */
  merge(actions) {
    Object.assign(this.#actionSet, actions);
    this.#buildActionMaps();
  }

  /**
   * Get action set object.
   * @returns {ActionSet<T>}
   */
  asObject() {
    return this.#actionSet;
  }

  /**
   * Run action. Return true on successful call.
   * @param {T} component Component reference.
   * @param {string[]} cmdArgs Action and arguments.
   * @returns {boolean} Either the corresponding action was called.
   */
  run(component, cmdArgs) {
    const [cmd, ...args] = cmdArgs;

    let action = this.#groups.has(cmd)
      ? this.#actions.get(`${cmd} ${args.shift()}`)
      : this.#actions.get(cmd);

    if (action == null)
      return false;

    action.run(component, ...args);
    return true;
  }
}
