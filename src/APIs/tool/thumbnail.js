const child_process = require("child_process");
const cmd = 'convert' // ImageMagick


/**
 * Thumbnail largest dimension in pixels.
 */
const MAXSIZE = 200


/**
 * Check if Tool is accessible.
 * @returns {Promise<Boolean>} Either if tool is acessible.
 */
async function hasTool() {
  return await new Promise(resolve => {
    child_process.exec(`${cmd} -version`, (err) => resolve(!err))
  })
}

/**
 * Generate thumbnail from source to destination.
 * @param {String} origin Source path.
 * @param {String} destination Thumbnail path.
 * @returns {Promise<Boolean>} `Success` Boolean.
 */
async function generateThumbnail(origin, destination) {
  return await new Promise(resolve => {
    child_process.exec(`${cmd} "${origin}[0]" -thumbnail ${MAXSIZE} "${destination}"`, 
    (err, stdout, stderr) => resolve(!err) )
  })
}


module.exports = { generateThumbnail, hasTool }