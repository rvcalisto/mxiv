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
 * Get class for frame type.
 * @param {FrameType} type Frame type.
 */
export function getClass(type) {
  return registry[type].class;
}

/**
 * Get policy for frame type.
 * @param {FrameType} type Frame type.
 */
export function getPolicy(type) {
  return registry[type].policy;
}

/**
 * Get tagname for frame type.
 * @param {FrameType} type Frame type.
 */
export function getTagName(type) {
  return `${type}-${tagSuffix}`;
}

/**
 * Returns frame type, description tuple array.
 * @returns {string[][]}
 */
export function getDescriptors() {
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
