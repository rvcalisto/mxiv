const logRegisters = false // useful for debugging


/**
 * @typedef ActionObject
 * @property {String} desc Action description.
 * @property {(args:string[])} run Main procedure.
 * @property {(lastArg:string, allArgs:string[])=>string[]} [options] Optional hints.
 * @property {(lastArg:string)=>boolean} [customFilter] Optional custom hint filter.
 * @property {Object.<string, ActionObject>} [methods] Optional methods for action.
 */

/**
 * Manage actions for a multitude of registered components.
 */
export const Actions = new class ActionDB {

  /**
   * Collection of actions per component.
   * @type {Object<string, Object<string, ActionObject>>}
   */
  #collection = {}

  /**
   * Register actions for given component.
   * - On register, a `<component>-all` is also created, inheriting `base` actions.
   * @param {String} component Component name.
   * @param {Object.<string, ActionObject>} actions Actions object.
   */
  register(component, actions) {
    if (logRegisters) console.log('[Actions] registered:', component)
    this.#collection[component] = actions

    // build '-all' for all components, as they inherit 'base'
    if (component === 'base') this.#buildComponentAlls()
  }

  /**
   * Build a joint object entry with `base` for each registered component.
   * * These entries are named `<component>-all` and contain both component and base properties.
   * * In the event of both component and base objects sharing a key, the base one will be overwritten.
   */
  #buildComponentAlls() {
    for (const actOwner in this.#collection) {
      if (actOwner === 'base' || actOwner.includes('-all')) continue

      const frameOverGlobal = {}
      Object.assign(frameOverGlobal, this.#collection['base'], this.#collection[actOwner])
      this.register(`${actOwner}-all`, frameOverGlobal)
    }
  }

  /**
   * Get actions object from given component.
   * @param {String} component Component from which to retrieve actions.
   * @returns {Object.<string, ActionObject>}
   */
  byOwner(component) {
    return this.#collection[component]
  }

  /**
   * Run action or method. Return true on successful call.
   * @param {String} component Component to which run action.
   * @param {String[]} cmdArgs Action and arguments.
   * @returns {Boolean}
   */
  run(component, cmdArgs) {
    const [cmd, ...args] = cmdArgs
    const action = this.#collection[component][cmd]
    if (!action) return false

    const actionIsMethod = action.methods && action.methods[args[0]]
    if (actionIsMethod) action.methods[args[0]].run(...args.slice(1))
    else action.run(...args)
    
    return true
  }
}


/**
 * @typedef {Object.<string, string[]>} AcceleratorSet
 */

/**
 * Manage keyboard accelarators for a multitude of registered actions. 
 */
export const Accelerators = new class AcceleratorDB {

  /**
   * Accelerators for components. Keycombo keys, action & args as values.
   * @type {Object<string, AcceleratorSet>}
   */
  #byKeycombo = {}

  /**
   * Accelerators for components. Action keys, keycombo as values. 
   * @type {Object<string, AcceleratorSet>}
   */
  #byAction = {}

  /**
   * Register or overwrite accelerators for given component.
   * - On register, a `<component>-all` is also created, inheriting `base` accelerators,
   * - it is also extended by any registered `<component>-user` accelerators .
   * @param {String} component 
   * @param {AcceleratorSet} accelerators 
   */
  register(component, accelerators) {
    if (logRegisters) console.log('[Accelerators] registered:', component)

    // redefine treated accelerators for component (keep empty values)
    this.#byKeycombo[component] = {}
    this.#overwriteEntries(this.#byKeycombo[component], accelerators, false)

    this.#buildAcceleratedActions(component, this.#byKeycombo[component])

    if (component === 'base-all') {
      // create '-all' entries for every common accelerator object
      for (const componentKey in this.#byKeycombo) {
        const metaComponent = componentKey.includes('-') || componentKey.includes('base')
        if (!metaComponent) this.#buildComponentAll(componentKey)
      }
    } else {
      // create '-all' for component on re-assign or component-user
      component = component.replace('-user', '')
      this.#buildComponentAll(component)
    }
  }

  /**
   * Treats keycombo as to make it an unique key.
   * @param {String} key Keycombo to be treated.
   * @return {String} Parsed unique accelerator.
   */
  parseKeycombo(key) {
    let treatedKey = key.toLowerCase()

    // translate aliased keys
    treatedKey = treatedKey.replace('space', ' ')

    // set key in predefined order to avoid multiple entries for same combo
    if (treatedKey.includes('+')) {
      const hasShift = treatedKey.includes('shift')
      const hasCtrl = treatedKey.includes('control')

      // re-assemble combo in predefined order [key+Shift+Control]
      treatedKey = treatedKey
      .replaceAll('+', '').replace('shift', '').replace('control', '')
      if (hasShift) treatedKey += '+shift'
      if (hasCtrl) treatedKey += '+control'
    }

    return treatedKey
  }

  /**
   * Assign new accelerator entries to object while treating keys to avoid 
   * duplicated combos and aliased names. Deletes keys with empty arrays by default.
   * @param {AcceleratorSet} oldAccelObj Accelerator object to be overwritten.
   * @param {AcceleratorSet} newAccelObj Accelerator properties to overwrite.
   * @param {true} deleteEmpty Delete keys whose value is an empty array.
   */
  #overwriteEntries(oldAccelObj, newAccelObj, deleteEmpty = true) {
    for ( const [key, value] of Object.entries(newAccelObj) ) {
      let treatedKey = this.parseKeycombo(key)
      
      if (deleteEmpty && value.length < 1) delete oldAccelObj[treatedKey]
      else oldAccelObj[treatedKey] = value
    }
  }

  /**
   * Builds a relation of actions accelerated for component.
   * @param {String} component Accelerated component.
   * @param {AcceleratorSet} accelObj Accelerators from which to build relation.
   */
  #buildAcceleratedActions(component, accelObj) {
    const acceleratedCmds = {}

    for (const [accelKey, cmdArgs] of Object.entries(accelObj)) {
      let [command, args] = cmdArgs

      if (!acceleratedCmds[command]) acceleratedCmds[command] = []
      acceleratedCmds[command].push(accelKey.replace(' ', 'space'))
    }

    this.#byAction[component] = acceleratedCmds
  }

  /**
   * Build component object that extends base and is extended by user accelerators.
   * These entries are named `<component>-all` and contain both component, base and user entries.
   * * In the event of both component and base objects sharing a key, the base one will be overwritten.
   * * In the event of both component and user objects sharing a key, the component one will be overwritten.
   * @param {String} component 
   */
  #buildComponentAll(component) {
    if ( component.includes('-all') ) return
    const newAccelObj = {}

    // ovewrite in order: base-all -> component -> user
    if (component !== 'base')
      this.#overwriteEntries(newAccelObj, this.#byKeycombo['base-all'] || {})
    
    this.#overwriteEntries(newAccelObj, this.#byKeycombo[component])
    this.#overwriteEntries(newAccelObj, this.#byKeycombo[`${component}-user`] || {})

    // register or update component-all
    this.register(`${component}-all`, newAccelObj)
  }

  /**
   * Return either keycombo matches keyboard event.
   * @param {String} keycombo Sorted, ordered, lower-case key combo string.
   * @param {KeyboardEvent} keyEvent Raw `KeyboardEvent` to match against.
   * @returns {Boolean}
   */
  #matchEvent(keycombo, keyEvent) {
    // fail if modifier keys mismatch
    if (keyEvent.shiftKey !== keycombo.includes('shift')) return false
    if (keyEvent.ctrlKey !== keycombo.includes('control')) return false

    // return mapped key & keyboardEvent key match
    const singleKey = keycombo.split('+')[0] // knowing first idx will be key
    return singleKey === keyEvent.key.toLowerCase()
  }

  /**
   * Returns action and arguments accelerated by given event. null otherwise.
   * @param {String} component From which accelerators to look in.
   * @param {KeyboardEvent} keyEvent Raw `KeyboardEvent` to match accelerators.
   * @returns {String[]?}
   */
  byEvent(component, keyEvent) {
    const accelObj = this.#byKeycombo[component]
    for (const keyCombo in accelObj) {
      if (this.#matchEvent(keyCombo, keyEvent)) return accelObj[keyCombo]
    }
    return null
  }

  /**
   * Return an array of keycombos accelarating a given action.
   * @param {String} component Accelerator Owner.
   * @param {String[]} actions Command strings accelerated by keys.
   * @param {false} exact Either to include all intersecting actions or exact matches only.
   * @returns {String[]}
   */
  byAction(component, actions, exact = false) {
    if (actions.length < 2) return this.#byAction[component][actions[0]] || []

    const componentEntries = Object.entries(this.#byKeycombo[component])
    const keycombos = []
    const matchLength = actions.length

    for (const [keycombo, cmdArgs] of componentEntries) {
      const match = exact ? String(actions) === String(cmdArgs) :
      String(actions) === String( cmdArgs.slice(0, matchLength) )

      if (match) keycombos.push(keycombo)
    }
    
    return keycombos
  }
}