import { ComponentAccelerators } from "./componentAccelerators.js";
import { FRAME } from "../tabs/tab.js";


/**
 * @typedef {import("./componentAccelerators.js").AcceleratorSet} AcceleratorSet
 */


/**
 * Manages accelerators for multiple components.
 */
export const AcceleratorController = new class {

  /**
   * @type {Object<string, ComponentAccelerators>}
   */
  #acceleratorSets = {};

  /**
   * @type {Set<String>}
   */
  #registeredComponents = new Set();

  /**
   * Get AcceleratorSet as object. Returns empty object if not stored.
   * @param {String} component 
   * @returns {AcceleratorSet}
   */
  #getSet(component) {
    try {
      return this.#acceleratorSets[component].asObject();
    } catch {
      return {};
    }
  }

  /**
   * Set default base accelerators to be inherited by other components.
   * @param {AcceleratorSet} accelerators 
   */
  setBaseDefaults(accelerators) {
    this.#acceleratorSets['base'] = new ComponentAccelerators(accelerators);

    this.#setComponentComposed('base');
    this.#propagateBaseChanges();
  }

  /**
   * Extend default base accelerators with user-defined ones. 
   * @param {AcceleratorSet} accelerators 
   */
  setBaseCustoms(accelerators) {
    this.#acceleratorSets['base-user'] = new ComponentAccelerators(accelerators);

    this.#setComponentComposed('base');
    this.#propagateBaseChanges();
  }

  /**
   * Set default accelerators for component.
   * @param {String} component 
   * @param {AcceleratorSet} accelerators 
   */
  setComponentDefaults(component, accelerators) {
    this.#registeredComponents.add(component);

    this.#acceleratorSets[component] = new ComponentAccelerators(accelerators);
    this.#setComponentComposed(component);
  }

  /**
   * Extend default accelerators for component with user-defined ones.
   * @param {String} component 
   * @param {AcceleratorSet} accelerators 
   */
  setComponentCustoms(component, accelerators) {
    this.#acceleratorSets[`${component}-user`] = new ComponentAccelerators(accelerators);
    this.#setComponentComposed(component);
  }

  /**
   * Creates composed object inheriting composed base, default and user-defined component accelerators.
   * @param {String} component Component
   */
  #setComponentComposed(component) {
    const composedSet = new ComponentAccelerators();

    if (component !== 'base') 
      composedSet.merge( this.#getSet('base-all'), false );

    composedSet.merge( this.#acceleratorSets[component].asObject(), false );
    composedSet.merge( this.#getSet(`${component}-user`) );

    this.#acceleratorSets[`${component}-all`] = composedSet;
  }

  /**
   * (Re)Creates composed accelerators for every registered component. 
   */
  #propagateBaseChanges() {
    const registeredComponentes = this.#registeredComponents.values();

    for (const component of registeredComponentes) {
      this.#setComponentComposed(component);
    }
  }

  /**
   * Returns component accelerators.
   * @param {string} component Component name.
   * @param {'composed'|'default'|'custom'} [type='composed'] Type version to retrieve.
   * @returns {ComponentAccelerators?}
   */
  getAccelerators(component, type = 'composed') {
    if (type === 'composed')
      return this.#acceleratorSets[`${component}-all`];
    else if (type === 'default')
      return this.#acceleratorSets[component];
    else
      return this.#acceleratorSets[`${component}-user`];
  }

  /**
   * Returns current FRAME AcceleratorSet.
   * @returns {ComponentAccelerators}
   */
  get currentFrameAccelerators() {
    if (!FRAME) return this.#acceleratorSets['base-all']
    return this.#acceleratorSets[`${FRAME.type}-all`];
  }
}