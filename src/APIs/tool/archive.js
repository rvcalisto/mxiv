// @ts-check
import { execFile } from 'child_process';
import path from 'path';


const isWin32 = process.platform === 'win32'; 
const newlineCode = isWin32 ? '\r\n' : '\n';
const cmd = '7z'; // 7-zip

// 7z doesn't add itself to PATH on Windows install. Include in our process.
if (isWin32)
  process.env.PATH += ";C:\\Program Files\\7-Zip";


/**
 * Check if Tool is accessible.
 * @returns {Promise<boolean>} Either if tool is accessible.
 */
export async function hasTool() {
  return await new Promise(resolve => {
    execFile(cmd, ['--help'], (err) => resolve(!err) );
  });
}

/**
 * Extract archive files into folder. Ignores directory structure, 
 * overwriting files under the same name as they're extracted.
 * @param {string} archiveFile Path to archive to extract files from.
 * @param {string} extractTo Path to folder to extract files onto.
 * @returns {Promise<boolean>} Success.
 */
export async function extract(archiveFile, extractTo) {
  // extract, preserve directory structure
  // 7z x -o"<extractTo>" "<archiveFile>"

  // extract only basefiles, force yes for overwrites
  // 7z e -y -o"<extractTo>" "<archiveFile>"

  return await new Promise(resolve => {
    execFile(cmd, ['e', '-y', `-o${extractTo}`, archiveFile],
             err => resolve(!err) );
  });
}

/**
 * List files from archive.
 * @param {string} archiveFile Path to archive file.
 * @returns {Promise<string[]>} Archive-relative file paths.
 */
export async function fileList(archiveFile) {
  const rawList = await new Promise(resolve => {
    execFile(cmd, ['l', '-slt', '-ba', archiveFile], (_err, stdout) => {
      resolve( stdout.toString().split(newlineCode) );
    });
  });

  const archivePaths = [];
  for (const line of rawList) {
    if ( line.includes('Path = ') )
      archivePaths.push( line.replace('Path = ', '') );
  }

  return archivePaths;
}

/**
 * Extract a single file from archive.
 * @param {string} file Archive-relative file path to extract.
 * @param {string} archiveFile Target archive to extract from.
 * @param {string} extractTo Folder path to extract file onto.
 * @returns {Promise<string>} Path to extracted file.
 */
export async function extractOnly(file, archiveFile, extractTo) {
  // as 7z "e" option does not preserve directory structure, resolve 
  // nested files to their basename to correctly compose extracted path.
  const fileIsNested = path.dirname(file) !== '.';
  const basename = fileIsNested ? path.basename(file) : file;

  return await new Promise(resolve => {
    execFile(cmd, ['e', `-o${extractTo}`, archiveFile, file], () => {
      resolve( path.join(extractTo, basename) );
    });
  });
}
