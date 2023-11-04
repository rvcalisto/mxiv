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
 * @param {String} archiveFile Path to archive to extract files from.
 * @param {String} extractTo Path to folder to extract files onto.
 */
async function extract(archiveFile, extractTo) {
  await new Promise((resolve, reject) => {
    child_process.exec(`${cmd} x "${archiveFile}" -o"${extractTo}"`, () => {
      resolve()
    })
  })
}


/**
 * List files from archive.
 * @param {String} archiveFile Path to archive file.
 * @returns {Promise<String[]>} Archive's basename files.
 */
async function fileList(archiveFile) {
  const rawList = await new Promise((resolve, reject) => {
    child_process.exec(`${cmd} l -slt -ba "${archiveFile}"`, (err, stdout) => {
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
 * @param {String} archiveFile Target archive to extract from.
 * @param {String} extractTo Folder path to extrat file onto.
 * @returns {Promise<String>} Path to extracted file.
 */
async function extractOnly(file, archiveFile, extractTo) {
  return await new Promise((resolve, reject) => {
    child_process.exec(`${cmd} e -i!"${file}" "${archiveFile}" -o"${extractTo}"`, () => {
      resolve( join(extractTo, file) )
    })
  })
}


module.exports = { fileList, extract, extractOnly, hasTool }