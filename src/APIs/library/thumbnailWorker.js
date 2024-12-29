import { Worker, workerData, parentPort, isMainThread } from 'worker_threads'
import { createThumbnail } from './thumbnailService.js'


/**
 * Thumbnail worker thread message on successful iteration.
 * @typedef ThumbnailWorkerMessage
 * @property {string} path Source folder/archive filepath.
 * @property {string?} thumbnail Generated thumbnail filepath.
 */

/**
 * @typedef {import('../tool/toolCapabilities.js').ToolCapabilities} ToolCapabilities
 */


if (!isMainThread)
  processThumbnails()


/**
 * Create thumbnails with worker threads.
 * @param {String[]} files Path array to thumbnail, split between threads.
 * @param {ToolCapabilities} tools Tool capabilities.
 * @param {(value:ThumbnailWorkerMessage)=>void} callback Callback to run on thread message.
 * @param {Number} [threads=2] Threads to use. 2 by default. 
 */
export async function createThumbnailMultiThreaded(files, tools, callback, threads = 2) {
  const part = Math.ceil(files.length / threads)
  const taskPromises = []

  for (let i = 0; i < threads; i++) {
    const slice = files.slice(i * part, (i * part) + part)
    if (slice.length < 1) continue

    taskPromises.push(new Promise(resolve => {
      new Worker(import.meta.filename, { workerData: { id: i, files: slice, tools: tools } })
        .on('message', callback)
        .on('exit', () => { resolve(undefined) })
    }))
  }

  await Promise.all(taskPromises)
}

/**
 * Create thumbnails for filepaths in `workerData.files`, message progress.
 * - Extract to exclusive sub-folder, avoid mistaking other thread resources under same name.
 */
async function processThumbnails() {
  const { id, files, tools } = workerData

  for (const filepath of files) {
    const thumbnail = await createThumbnail(filepath, tools, id)

    parentPort.postMessage({
      path: filepath,
      thumbnail: thumbnail
    })
  }
}
