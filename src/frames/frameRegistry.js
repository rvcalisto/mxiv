import { Viewer } from "./viewer/viewer.js";
import { Library } from "./library/library.js";


/**
 * @typedef FrameEntry
 * @property {String} description
 * @property {typeof import("./genericFrame.js").GenericFrame} class
 * @property {FramePolicy} policy
 */

/**
 * @typedef FramePolicy
 * @property {boolean} allowDuplicate
 * @property {boolean} allowProfiling
 */


/**
 * Frame component registry,
 */
export const FrameRegistry = new class {

  /**
   * Frame registry entries.
   * @type {Object<string, FrameEntry>}
   */
  #registry = {

    'viewer': {
      'description': 'file navigator and general viewer (default)',
      'class': Viewer,
      'policy': {
        allowDuplicate: true,
        allowProfiling: true
      }
    },

    'library': {
      'description': 'collection of media directories and archives',
      'class': Library,
      'policy': {
        allowProfiling: true,
        allowDuplicate: false
      }
    }
  }

  // define frame customElements
  constructor() {
    for (const frame in this.#registry) {
      const frameClass = this.#registry[frame].class;
      customElements.define(`${frame}-component`, frameClass);
    }
  }

  /**
   * @param {string} frame Frame type.
   * @returns {typeof import("./genericFrame.js").GenericFrame?}
   */
  getClass(frame) {
    return this.#registry[frame]?.class;
  }

  /**
   * @param {string} frame Frame type.
   * @returns {FramePolicy?}
   */
  getPolicy(frame) {
    return this.#registry[frame]?.policy;
  }

  /**
   * Returns frame, description tuple array.
   * @returns {String[][]}
   */
  getDescriptors() {
    return Object.entries(this.#registry)
      .map( ([frame, entry]) => [frame, entry.description] );
  }
};
