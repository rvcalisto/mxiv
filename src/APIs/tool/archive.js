import child_process from 'child_process';
import path from 'path';


const isWin32 = process.platform === 'win32'; 
const newlineCode = isWin32 ? '\r\n' : '\n'
const cmd = '7z' // 7zip

// 7z doesn't add itself to PATH on Windows install. Include in our process.
if (isWin32) process.env.PATH += ";C:\\Program Files\\7-Zip"


/**
 * Check if Tool is accessible.
 * @returns {Promise<Boolean>} Either if tool is acessible.
 */
export async function hasTool() {
  return await new Promise(resolve => {
    child_process.exec(`${cmd} --help`, (err) => resolve(!err) )
  })
}

/**
 * Extract archive base files into folder ignoring directory structure 
 * and overwriting files of same name as extracted.
 * @param {String} archiveFile Path to archive to extract files from.
 * @param {String} extractTo Path to folder to extract files onto.
 */
export async function extract(archiveFile, extractTo) {
  // extract, preserve directory sctructure
  // 7z x "<archiveFile>" -o"<extractTo>"
  
  // extract only basefiles, force yes for overwrites
  // 7z e "<archiveFile>" -y -o"<extractTo>"

  return await new Promise(resolve => {
    child_process.exec(`${cmd} e -y "${archiveFile}" -o"${extractTo}"`, 
    (err) => resolve(!err) )
  })
}

/**
 * List files from archive.
 * @param {String} archiveFile Path to archive file.
 * @returns {Promise<String[]>} Archive's basename files.
 */
export async function fileList(archiveFile) {
  const rawList = await new Promise(resolve => {
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
export async function extractOnly(file, archiveFile, extractTo) {
  const fileIsNested = path.dirname(file) !== '.'
  
  // if archived file is nested (in a subdirectory), 7z "e" option will only
  // extract the basefile, so return the extracted path accordingly.
  return await new Promise(resolve => {
    child_process.exec(`${cmd} e -i!"${file}" "${archiveFile}" -o"${extractTo}"`, 
    (err) => {
      if (fileIsNested) file = path.basename(file)
      resolve( path.join(extractTo, file) )
    })
  })
}
