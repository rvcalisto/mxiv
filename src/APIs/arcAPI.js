/* Uses 7z to handle archives. */

const child_process = require("child_process"); // runs 7z
const path = require("path");

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
 * Extract archive base files into folder ignoring directory structure 
 * and overwriting files of same name as extracted.
 * @param {String} archiveFile Path to archive to extract files from.
 * @param {String} extractTo Path to folder to extract files onto.
 */
async function extract(archiveFile, extractTo) {
  // extract, preserve directory sctructure
  // 7z x "<archiveFile>" -o"<extractTo>"
  
  // extract only basefiles, force yes for overwrites
  // 7z e "<archiveFile>" -y -o"<extractTo>"

  await new Promise((resolve, reject) => {
    child_process.exec(`${cmd} e -y "${archiveFile}" -o"${extractTo}"`, () => {
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
  const fileIsNested = path.dirname(file) !== '.'

  return await new Promise((resolve, reject) => {
    child_process.exec(`${cmd} e -i!"${file}" "${archiveFile}" -o"${extractTo}"`, () => {
      // if archived file is nested (in a subdirectory), 7z "e" option will only
      // extract the basefile, so return the extracted path accordingly.
      if (fileIsNested) file = path.basename(file)
      resolve( path.join(extractTo, file) )
    })
  })
}


module.exports = { fileList, extract, extractOnly, hasTool }