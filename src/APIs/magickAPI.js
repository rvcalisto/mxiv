/* ImageMagick wrapper for thumbnail generation  */

// TODO: use ffmpeg instead as it is more commonly installed (?)
// while ffmpeg a common library, magick is much faster for thumbnail generation...
// `ffmpeg -v error -y -i "${origin}" -vf scale=-1:${MAXSIZE} ${destination}` // image
// `ffmpeg -v error -y -i "${origin}" -vf scale=-1:${MAXSIZE} -ss 00 -vframes 1 ${destination}` // img+vid


const child_process = require("child_process"); // runs 7z
const cmd = 'convert'

// thumnail largest dimension in pixels
const MAXSIZE = 200


/**
 * Check if Tool is accessible.
 * @returns {Promise<Boolean>} Either if tool is acessible.
 */
async function hasTool() {
  const success = await new Promise((resolve, reject) => {
    child_process.exec(`${cmd} -version`, (err) => resolve(!err))
  })
  return success
}


/**
 * Generate thumbnail from source to destination.
 * @param {String} origin Source path.
 * @param {String} destination Thumbnail path.
 * @returns {Promise<Boolean>} `Success` Boolean.
 */
async function generateThumbnail(origin, destination) {
  const success = await new Promise((resolve, reject) => {
    child_process.exec(`${cmd} "${origin}[0]" -thumbnail ${MAXSIZE} "${destination}"`, 
    (err, stdout) => resolve(!err))
  })
  return success
}


module.exports = { generateThumbnail, hasTool }