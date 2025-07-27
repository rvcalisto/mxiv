// @ts-check
import { Viewer } from "./viewer/viewer.js";
import { Library } from "./library/library.js";


/**
 * @typedef FrameEntry
 * @property {string} description
 * @property {typeof import("./genericFrame.js").GenericFrame} class
 * @property {FramePolicy} policy
 */

/**
 * @typedef FramePolicy
 * @property {boolean} allowDuplicate
 * @property {boolean} allowProfiling
 */

/**
 * @typedef {keyof registry} FrameType
 */


/**
 * Frame registry entries.
 * @satisfies {Object<string, FrameEntry>}
 */
const registry = {
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

/**
 * Frame custom element tag suffix.
 */
const tagSuffix = 'component';


/**
 * Get policy for frame type.
 * @param {FrameType} type Frame type.
 */
export function getFramePolicy(type) {
  return registry[type].policy;
}

/**
 * Create and return new frame DOM element.
 * @param {FrameType} type Frame type.
 */
export function createFrame(type) {
  return document.createElement(`${type}-${tagSuffix}`);
}

/**
 * Returns frame type, description tuple array.
 * @returns {string[][]}
 */
export function frameDescriptors() {
  return Object.entries(registry)
    .map( ([type, entry]) => [type, entry.description] );
}

/**
 * Check if string is a valid frame type.
 * @param {string} type Type to test.
 * @returns {boolean}
 */
export function isFrameType(type) {
  return registry[type] != null;
}

/**
 * Define frame customElements.
 */
function initialize() {
  for (const frame in registry) {
    const frameClass = registry[frame].class;
    customElements.define(`${frame}-${tagSuffix}`, frameClass);
  }
}

initialize();
