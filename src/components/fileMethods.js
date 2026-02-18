import { notify } from "./notifier.js";


/**
 * Add or remove tags from given file.
 * @param {string?} filepath Absolute file path.
 * @param {boolean} add Add tags instead of removing them.
 * @param  {...string} tags Tags to associate to current file.
 */
export async function tag(filepath, add, ...tags) {
  if (!filepath)
    return notify('no file to tag', 'tag');

  // treat tags
  const treatedTags = tags.map( tag => tag.toLowerCase().trim() )
    .filter(tag => tag !== '');

  if (treatedTags.length < 1) 
    return notify('no tags to update');

  const success = add
    ? await elecAPI.addTags(filepath, ...treatedTags)
    : await elecAPI.removeTags(filepath, ...treatedTags);

  notify(`${success ? '' : 'no '}tags updated`, 'tag');
}

/**
 * Rename all occurences of one or more tags.
 * @param {string[]} tags Tags to rename.
 */
export async function renameTags(...tags) {
  // treat tags
  const treatedTags = tags.map( tag => tag.toLowerCase().trim() )
    .filter(tag => tag !== '');

  if (treatedTags.length < 1)
    return notify('no tags to update');

  const updatedEntries = await elecAPI.renameTags(...treatedTags);
  notify(`${updatedEntries} entries updated`);
}

/**
 * Delete all occurences of one or more tags.
 * @param {string[]} tags Tags to delete.
 */
export async function deleteTags(...tags) {
  // treat tags
  const treatedTags = tags.map( tag => tag.toLowerCase().trim() )
    .filter(tag => tag !== '');

  if (treatedTags.length < 1)
    return notify('no tags to update');

  const updatedEntries = await elecAPI.deleteTags(...treatedTags);
  notify(`${updatedEntries} entries updated`);
}

/**
 * Run user script on system shell.
 * @param {string} userScript User script.
 * @param {string?} filepath Absolute file path, if any.
 * @param {string} optMsg Optional message to display.
 */
export async function runScript(userScript, filepath, optMsg) {
  if (!userScript)
    return notify('no script to run', 'runScript');

  const success = await elecAPI.runOnFile(userScript, filepath);
  if (!success)
    return notify(`this script needs a file to run`, 'runScript');
  
  console.log(`Ran user script:`, {
    script: userScript,
    file: filepath
  });

  if (optMsg)
    notify(optMsg, 'runScript');
}

/**
 * Check file against substrings or tags.
 * - Prepend '-' to a query to exclude a tag.
 * @param {{ name: string, path: string }} file File to test against.
 * @param {string[]} queries Substrings or tags to check.
 * @returns {boolean} Match
 */
export function matchNameOrTags(file, queries) {
  const tags = elecAPI.getTags(file.path);
  const name = file.name.toLowerCase();
  
  for (const query of queries) {
    if (query[0] === '-') {
      // exclude tag query from results
      if ( tags.includes( query.slice(1) ) )
        return false;
    } else {
      if ( !name.includes(query) && !tags.includes(query) )
        return false;
    }
  }
  
  return true;
}
