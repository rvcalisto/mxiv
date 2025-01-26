import { ComponentAccelerators } from "./componentAccelerators.js";
import { FRAME } from "../tabs/tab.js";


/**
 * @typedef {import("./componentAccelerators.js").AcceleratorSet} AcceleratorSet
 */


/**
 * Manages accelerators for multiple components.
 */
export const acceleratorService = new class {

  /**
   * Collection of component accelerators.
   * @type {Object<string, ComponentAccelerators>}
   */
  #collection = {};

  /**
   * Composable components (non-meta).
   * @type {Set<String>}
   */
  #components = new Set();

  /**
   * Returns component AcceleratorSet. Empty if not stored.
   * @param {String} component Component name.
   * @returns {AcceleratorSet}
   */
  #getSet(component) {
    return this.#collection[component]?.asObject() || {};
  }

  /**
   * Set common base accelerators.
   * @param {AcceleratorSet} accelerators Accelerator set.
   */
  setBaseDefaults(accelerators) {
    this.#collection['base'] = new ComponentAccelerators(accelerators);

    this.#buildComposedAccelerators('base');
    this.#propagateBaseChanges();
  }

  /**
   * Extends common base accelerators with user-defined ones. 
   * @param {AcceleratorSet} accelerators Accelerator set.
   */
  setBaseCustoms(accelerators) {
    this.#collection['base-user'] = new ComponentAccelerators(accelerators);

    this.#buildComposedAccelerators('base');
    this.#propagateBaseChanges();
  }

  /**
   * Set component default accelerators.
   * @param {String} component Component name.
   * @param {AcceleratorSet} accelerators Accelerator set.
   */
  setComponentDefaults(component, accelerators) {
    this.#components.add(component);

    this.#collection[component] = new ComponentAccelerators(accelerators);
    this.#buildComposedAccelerators(component);
  }

  /**
   * Extends component default accelerators with user-defined ones.
   * @param {String} component Component name.
   * @param {AcceleratorSet} accelerators Accelerator set.
   */
  setComponentCustoms(component, accelerators) {
    this.#collection[`${component}-user`] = new ComponentAccelerators(accelerators);
    this.#buildComposedAccelerators(component);
  }

  /**
   * Builds composed component accelerators.
   * @param {String} component Component name.
   */
  #buildComposedAccelerators(component) {
    const composedAccelerators = new ComponentAccelerators();

    if (component !== 'base') 
      composedAccelerators.merge( this.#getSet('base-all'), false );

    composedAccelerators.merge( this.#collection[component].asObject(), false );
    composedAccelerators.merge( this.#getSet(`${component}-user`) );

    this.#collection[`${component}-all`] = composedAccelerators;
  }

  /**
   * Builds and updates composed accelerators for each component. 
   */
  #propagateBaseChanges() {
    this.#components.forEach(component => {
      this.#buildComposedAccelerators(component);
    });
  }

  /**
   * Returns component accelerators.
   * @param {string} component Component name.
   * @param {'composed'|'default'|'custom'} [type='composed'] Accelerator layer.
   * @returns {ComponentAccelerators?}
   */
  getAccelerators(component, type = 'composed') {
    if (type === 'composed')
      return this.#collection[`${component}-all`];
    else if (type === 'default')
      return this.#collection[component];
    else
      return this.#collection[`${component}-user`];
  }

  /**
   * Returns current FRAME Accelerators.
   * @returns {ComponentAccelerators}
   */
  get currentFrameAccelerators() {
    if (!FRAME) return this.#collection['base-all']
    return this.#collection[`${FRAME.type}-all`];
  }
}
