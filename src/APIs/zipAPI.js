/* Uses 7z to handle archives. */

const child_process = require("child_process"); // runs 7z
const { join } = require("path");

const { platform } = require("os"); // for Windows specific constants
const isWin32 = platform() === 'win32'

const newlineCode = isWin32 ? '\r\n' : '\n'
const cmd = '7z'

// 7z doesn't add itself to PATH on Windows install. Include in our process.
if (isWin32) process.env.PATH += ";C:\\Program Files\\7-Zip"


/**
 * Check if Tool is accessible.
 * @returns {Promise<Boolean>} Either if tool is acessible.
 */
async function hasTool() {
  const success = await new Promise((resolve, reject) => {
    child_process.exec(`${cmd} --help`, (err) => resolve(!err))
  })
  return success
}


/**
 * Extract archive into folder.
 * @param {String} zipFile Path to archive to extract files from.
 * @param {String} unzipTo Path to folder to extract files onto.
 */
async function extract(zipFile, unzipTo) {
  await new Promise((resolve, reject) => {
    child_process.exec(`${cmd} x "${zipFile}" -o"${unzipTo}"`, () => {
      resolve()
    })
  })
}


/**
 * List files from archive.
 * @param {String} zipFile Path to archive file.
 * @returns {Promise<String[]>} Archive's basename files.
 */
async function fileList(zipFile) {
  const rawList = await new Promise((resolve, reject) => {
    child_process.exec(`${cmd} l -slt -ba "${zipFile}"`, (err, stdout) => {
      resolve( stdout.toString().split(newlineCode) )
    })
  })

  let arr = []
  for (const line of rawList) {
    if ( line.includes('Path = ') )
      arr.push( line.replace('Path = ', '') )
  }
  return arr
}


/**
 * Extract a single file from archive.
 * @param {String} file File basename.
 * @param {String} zipFile Target archive to extract from.
 * @param {String} unzipTo Folder path to extrat file onto.
 * @returns {Promise<String>} Path to extracted file.
 */
async function extractOnly(file, zipFile, unzipTo) {
  return await new Promise((resolve, reject) => {
    child_process.exec(`${cmd} e -i!"${file}" "${zipFile}" -o"${unzipTo}"`, () => {
      resolve( join(unzipTo, file) )
    })
  })
}


module.exports = { fileList, extract, extractOnly, hasTool }