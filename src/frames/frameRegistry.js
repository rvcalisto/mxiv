import { Viewer } from "./viewer/viewer.js";
import { Library } from "./library/library.js";


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
   * @type {Object<string, typeof import("./genericFrame.js").GenericFrame>}
   */
  #definedFrames = {};

  /** 
   * @type {Object<string, FramePolicy>} 
   */
  #policies = {};

  constructor() {
    this.#defineFrame('viewer', Viewer, {
      allowDuplicate: true,
      allowProfiling: true
    });

    this.#defineFrame('library', Library, {
      allowProfiling: true,
      allowDuplicate: false
    });
  }

  /**
   * @param {string} type Class name, lowercase.
   * @param {typeof import("./genericFrame.js").GenericFrame} frameClass Frame Class.
   * @param {FramePolicy} policy Frame policy object.
   */
  #defineFrame(type, frameClass, policy) {
    customElements.define(`${type}-component`, frameClass);
    this.#definedFrames[type] = frameClass;
    this.#policies[type] = policy;
  }

  /**
   * @param {string} frame Frame type.
   * @returns {typeof import("./genericFrame.js").GenericFrame?}
   */
  getClass(frame) {
    return this.#definedFrames[frame];
  }

  /**
   * @param {string} frame Frame type.
   * @returns {FramePolicy?}
   */
  getPolicy(frame) {
    return this.#policies[frame];
  }
};
