import { AppNotifier } from "./notifier.js";


/**
 * Add or remove tags from given file.
 * @param {string?} filepath Absolute file path.
 * @param {boolean} add Add tags instead of removing them.
 * @param  {...string} tags Tags to associate to current file.
 */
export async function tag(filepath, add, ...tags) {
  if (!filepath)
    return AppNotifier.notify('no file to tag', 'tag');

  // treat tags
  tags = tags.map( tag => tag.toLowerCase().trim() )
    .filter(tag => tag !== '');
  
  if (tags.length < 1) 
    return AppNotifier.notify('no tags to update');

  const success = add ?
    await elecAPI.addTags(filepath, ...tags) :
    await elecAPI.removeTags(filepath, ...tags);

  AppNotifier.notify(`${success ? '' : 'no '}tags updated`, 'tag');
}

/**
 * Run user script on system shell.
 * @param {string} userScript User script.
 * @param {string?} filepath Absolute file path, if any.
 * @param {string} optMsg Optional message to display.
 */
export async function runScript(userScript, filepath, optMsg) {
  if (!userScript)
    return AppNotifier.notify('no script to run', 'runScript');

  const success = await elecAPI.runOnFile(userScript, filepath);
  if (!success)
    return AppNotifier.notify(`this script needs a file to run`, 'runScript');
  
  console.log(`Ran user script:`, {
    script: userScript,
    file: filepath
  });

  if (optMsg)
    AppNotifier.notify(optMsg, 'runScript');
}
