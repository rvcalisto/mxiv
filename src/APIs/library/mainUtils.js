const fs = require('fs');
const os = require('os');
const p = require('path');
const { listFiles } = require('../file/fileSearch')
const { fileType } = require('../file/fileTools')
const archiveTool = require('../tool/archive');
const thumbnailTool = require('../tool/thumbnail');
const { randomUUID } = require('crypto');


/**
 * Local folder for cover thumbnail storage.
 */
const COVERDIR = process.platform === 'win32' ?
  p.join(process.env.LOCALAPPDATA, 'mxiv', 'covers') :
  p.join(os.homedir(), '.cache', 'mxiv', 'covers')

/**
 * Generic icon to use secondarily.
 */
const PLACEHOLDERICON = p.join(__dirname, '../../icons/libraryIconPlaceholder.jpg')

/**
 * Extract tool present. I promise we'll know, eventually.
 * @type {boolean|undefined}
 */
let canExtract = archiveTool.hasTool().then(value => canExtract = value)

/**
 * Thumbnail tool present. I promise we'll know, eventually.
 * @type {boolean|undefined}
 */
let canThumbnail = thumbnailTool.hasTool().then(value => canThumbnail = value)


/**
 * Return library folder/archive candidates.
 * @param {String} folderPath Path to folder to be mapped recursively.
 * @param {Number} depth How many levels to recurse. Defaults to `Infinity`.
 * @param {String[]} mappedPaths Used internally on recursive calls.
 * @returns {Promise<String[]>} Mapped paths.
 */
async function getCandidates(folderPath, depth = Infinity, mappedPaths = []) {
  const ls = await listFiles(folderPath)

  // add archives
  if (canExtract)
    for (const archive of ls.archives)
      mappedPaths.push(archive.path)

  // path has viewable files, add absolute path
  if (ls.files.length)
    mappedPaths.push(ls.target.path)

  // process subfolders recursively
  if (depth-- > 0)
    for (const dir of ls.directories) 
      await getCandidates(dir.path, depth, mappedPaths)
  
  return mappedPaths
}

/**
 * Check if cover thumbnail path exists, try to create it if not found.
 * @returns {Promise<Boolean>} Either path exists at the end of execution.
 */
async function createThumbnailDirectory() {
  const folderExists = await new Promise(resolve => {
    fs.stat( COVERDIR, (err, stat) => resolve(!err && stat != null) )
  })
  
  return folderExists || new Promise(resolve => {
    fs.mkdir( COVERDIR, { recursive: true }, (err) => {
      if (err) console.log('MXIV: Couldn\'t create thumbnails folder\n', err)
      else console.log(`MXIV: Created thumbnails folder at '${COVERDIR}'`)
      resolve(!err)
    })
  })
}

/**
 * Delete entire library & cover thumbnail folder.
 * @returns {Promise<Boolean>} Success.
 */
async function deleteThumbnailDirectory() {
  return await new Promise(resolve => {
    fs.rm(COVERDIR, { recursive: true }, (err) => {
      if (!err) console.log('MXIV: successfuly deleted thumbnail covers folder')
      else console.log('MXIV: couldn\'t delete thumbnail covers folder', err)
      resolve(!err)
    })
  })
}

/**
 * Create thumbnail from file. Returns thumbnail path.
 * @param {String} path Folder/archive path.
 * @returns {Promise<String>} Path to generated thumbnail.
 */
async function createThumbnail(path) {
  if ( fileType(path) === 'archive' )
    return await coverFromArc(path)
  else
    return await coverFromDir(path)
}

/**
 * Delete thumbnail.
 * @param {String} path Path to thumbnail.
 * @returns {Promise<Boolean>} Success.
 */
async function deleteThumbnail(path) {
  if (!path) return false

  const insideCoverDir = p.dirname(path) === COVERDIR
  if (!insideCoverDir) {
    console.error(`MXIV::FORBIDDEN: Tried to delete non-thumbnail file!\ntargeted path: ${path}`)
    return false
  }
 
  return new Promise(resolve => {
    fs.rm(path, err => {
      // ENOENT: Thumbnail has already been deleted, ignore.
      if (!err || err.code === 'ENOENT') return resolve(true)
      
      console.error(`MXIV: Failed to delete thumbnail at: ${path}\n`, err)
      resolve(false)
    })
  })
}

/**
 * Asynchronously creates cover from folder's first file.
 * @param {String} path Folder Path.
 * @returns {Promise<String>} Cover Path.
 */
async function coverFromDir(path) {
  // get first file from folder
  const firstFile = await new Promise(resolve => {
    fs.readdir( path, (err, files) => resolve( p.join(path, files[0]) ) );
  })
  
  // firstFile may not be an image! use placeholder
  const isImg = fileType(firstFile) === 'image'
  if (!isImg || !canThumbnail) return await coverPlaceholder()

  // generate cover path to be used as UUID.extention
  const ext = p.extname(firstFile)
  const coverPath = p.join(COVERDIR, `${randomUUID()}${ext}`)
  const thumbnailOK = await thumbnailTool.generateThumbnail(firstFile, coverPath)

  return coverPath
}

/**
 * Asynchronously creates cover from archive's first file.
 * @param {String} path Folder Path.
 * @returns {Promise<String>} Cover Path.
 */
async function coverFromArc(path) {
  // extract first file from archive and get its path
  const firstFile = ( await archiveTool.fileList(path) )[0]

  // firstFile may not be an image! use placeholder
  const isImg = fileType(firstFile) === 'image'
  if (!isImg || !canThumbnail) return await coverPlaceholder()

  const extractedPath = await archiveTool.extractOnly(firstFile, path, COVERDIR)

  // generate cover path to be used as UUID.extention. Remove extracted source.
  const ext = p.extname(extractedPath)
  const coverPath = p.join(COVERDIR, `${randomUUID()}${ext}`)
  const thumbnailOK = await thumbnailTool.generateThumbnail(extractedPath, coverPath)
  fs.rmSync(extractedPath)

  return coverPath
}

/**
 * Generate a cover placeholder and return its path.
 * @returns {Promise<String>} Placeholder thumbnail path.
 */
async function coverPlaceholder() {
  // TODO: generate cover for videos, custom icon for audio
  const placeholderCover = p.join(COVERDIR, `${randomUUID()}.jpg`)
  await new Promise(resolve => {
    fs.copyFile( PLACEHOLDERICON, placeholderCover, () => resolve() )
  })
  return placeholderCover
}


module.exports = { getCandidates, createThumbnail, deleteThumbnail, createThumbnailDirectory, deleteThumbnailDirectory }