// @ts-check
import { execFile } from 'child_process';
const cmd = 'magick'; // ImageMagick


/**
 * Thumbnail largest dimension in pixels.
 */
const MAXSIZE = 200;


/**
 * Check if Tool is accessible.
 * @returns {Promise<boolean>} Either if tool is accessible.
 */
export async function hasTool() {
  return await new Promise(resolve => {
    execFile(cmd, ['-version'], (err) => resolve(!err) );
  });
}

/**
 * Generate thumbnail from source to destination.
 * @param {string} origin Source path.
 * @param {string} destination Thumbnail path.
 * @returns {Promise<boolean>} Success.
 */
export async function generateThumbnail(origin, destination) {
  return await new Promise(resolve => {
    execFile(cmd, [`${origin}[0]`, '-thumbnail', `${MAXSIZE}`, destination], 
             err => resolve(!err) );
  });
}
