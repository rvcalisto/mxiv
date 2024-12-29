// @ts-check
import { hasTool as hasArchiveTool } from './archive.js';
import { hasTool as hasThumbnailTool } from './thumbnail.js';


/**
 * Possible tool capabilities for feature switches.
 * @typedef ToolCapabilities
 * @property {boolean} canExtract Either process can extract archives.
 * @property {boolean} canThumbnail Either process can generate thumbnails.
 */

/**
 * Verified tool availability for current environment.
 * @type {ToolCapabilities}
 */
export const tools = {
  canExtract: false,
  canThumbnail: false
};


/**
 * Probe tool availability once in the main process.
 */
function initialize() {
  hasArchiveTool().then(value => tools.canExtract = value);
  hasThumbnailTool().then(value => tools.canThumbnail = value);
}

initialize();
