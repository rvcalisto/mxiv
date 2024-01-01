import { Accelerators } from "./accelerators.js"
import { FRAME } from "../tabs/tab.js"


/**
 * Manages accelerators for multiple components.
 */
export const AcceleratorDB = new class _AcceleratorDB {

  /**
   * @type {Object<string, Accelerators>}
   */
  #acceleratorSets = {}

  /**
   * @type {Set<String>}
   */
  #registeredComponents = new Set()

  /**
   * Get AcceleratorSet as object. Returns empty object if not stored.
   * @param {String} component 
   * @returns {import('./accelerators.js').AcceleratorSet}
   */
  #getSet(component) {
    try {
      return this.#acceleratorSets[component].asObject()
    } catch {
      return {}
    }
  }

  /**
   * Set default base accelerators to be inherited by other components.
   * @param {import('./accelerators.js').AcceleratorSet} accelerators 
   */
  setBaseDefaults(accelerators) {
    this.#acceleratorSets['base'] = new Accelerators(accelerators)

    this.#setComponentComposed('base')
    this.#propagateBaseChanges()
  }

  /**
   * Extend default base accelerators with user-defined ones. 
   * @param {import('./accelerators.js').AcceleratorSet} accelerators 
   */
  setBaseCustoms(accelerators) {
    this.#acceleratorSets['base-user'] = new Accelerators(accelerators)

    this.#setComponentComposed('base')
    this.#propagateBaseChanges()
  }

  /**
   * Set default accelerators for component.
   * @param {String} component 
   * @param {import('./accelerators.js').AcceleratorSet} accelerators 
   */
  setComponentDefaults(component, accelerators) {
    this.#registeredComponents.add(component)

    this.#acceleratorSets[component] = new Accelerators(accelerators)
    this.#setComponentComposed(component)
  }

  /**
   * Extend default accelerators for component with user-defined ones.
   * @param {String} component 
   * @param {import('./accelerators.js').AcceleratorSet} accelerators 
   */
  setComponentCustoms(component, accelerators) {
    this.#acceleratorSets[`${component}-user`] = new Accelerators(accelerators)
    this.#setComponentComposed(component)
  }

  /**
   * Creates composed object inheriting composed base, default and user-defined component accelerators.
   * @param {String} component Component
   */
  #setComponentComposed(component) {
    const composedSet = new Accelerators()

    if (component !== 'base') 
      composedSet.extend( this.#getSet('base-all'), false )

    composedSet.extend( this.#acceleratorSets[component].asObject(), false )
    composedSet.extend( this.#getSet(`${component}-user`) )

    this.#acceleratorSets[`${component}-all`] = composedSet
  }

  /**
   * (Re)Creates composed accelerators for every registered component. 
   */
  #propagateBaseChanges() {
    const registeredComponentes = this.#registeredComponents.values()

    for (const component of registeredComponentes) {
      this.#setComponentComposed(component)
    }
  }

  /**
   * Returns `Accelerators` object for given component.
   * @param {'composed'|'default'|'custom'} type Type version to retrieve.
   * @returns {Accelerators?}
   */
  getAccel(component, type = 'composed') {
    if (type === 'composed')
      return this.#acceleratorSets[`${component}-all`]
    else if (type === 'default')
      return this.#acceleratorSets[component]
    else
      return this.#acceleratorSets[`${component}-user`]
  }

  /**
   * Returns current FRAME AcceleratorSet.
   * @returns {Accelerators}
   */
  get currentFrameAccelerator() {
    const currentComponent = FRAME.constructor.name.toLowerCase()
    return this.#acceleratorSets[`${currentComponent}-all`]
  }
}