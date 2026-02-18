// @ts-check
import { JsonStorage } from '../tool/jsonStorage.js';
import { tagDBFile } from '../tool/appPaths.js';
import { access } from 'fs';


/**
 * Persistent TagStorage JSON file structure.
 * @typedef TagStorageFileStruct
 * @property {Object<string, number[]>} _files Filepath -> TagIDs
 * @property {Object<number, string>} _tags TagID -> TagName
 * @property {{nextID: number, orphanIDs: number[]}} _control Meta
 */


/**
 * TagStorage state wrapper. Abstracts away serialized data.
 */
export class TagState extends Map {

  /**
   * Meta entry keys.
   */
  static meta = {
    files: '_files',
    tags: '_tags',
    control: '_control'
  };

  /**
   * Entries which to preserve super get/set behavior.
   */
  static #metaEntries = ( () => Object.values(this.meta) )();

  /**
   * Tag ID -> Name table.
   * @type {Object<number, string>}
   */
  #tagId2Name;

  /**
   * Inverted `#tagIdName` table for reverse search. Virtual, not persisted.
   * @type {Map<string, number>}
   */
  #tagName2Id = new Map();
  
  /**
   * File Path -> Tag-IDs table.
   * @type {Object<string, number[]>}
   */
  #file2TagIDs;

  /**
   * Control properties.
   * @type {{nextID: number, orphanIDs: number[]}}
   */
  #control;

  /**
   * Initialize meta entries.
   * @param  {...any} args 
   */
  constructor(...args) {
    super(...args);
    this.#generateMetaStructure();
  }

  /**
   * Get or create meta entry structure, references.
   */
  #generateMetaStructure() {
    if ( !super.has(TagState.meta.files) )
      super.set(TagState.meta.files, {});

    if ( !super.has(TagState.meta.tags) )
      super.set(TagState.meta.tags, {});

    if ( !super.has(TagState.meta.control) )
      super.set(TagState.meta.control, { nextID: 0, orphanIDs: [] });

    this.#file2TagIDs = super.get(TagState.meta.files);
    this.#tagId2Name  = super.get(TagState.meta.tags);
    this.#control     = super.get(TagState.meta.control);
  }

  /**
   * Deserialize and return tags for file. Empty if file not found.
   * - Super behavior preserved for meta entries.
   * @param {string} key 
   * @returns {string[]}
   * @override
   */
  get(key) {
    if ( TagState.#metaEntries.includes(key) ) {
      return super.get(key);
    }

    const fileIDs = this.#file2TagIDs[key] || [];
    return fileIDs.map(id => this.#tagId2Name[id]);
  }

  /**
   * Set tags for file, then serialize it. Delete if given empty array.
   * - Super behavior preserved for meta entries.
   * @param {string} key 
   * @param {string[]} value Tag array for non-meta entries.
   * @override
   */
  set(key, value) {
    if ( TagState.#metaEntries.includes(key) ) {
      super.set(key, value);
      return this;
    }

    // (re)build inverted tag ID -> Name when empty
    if (this.#tagName2Id.size < 1) {
      for (const id in this.#tagId2Name)
        this.#tagName2Id.set(this.#tagId2Name[id], Number(id) );
    }

    const tagIDs = [...new Set(value)].map(name => {
      let tagID = this.#tagName2Id.get(name);

      if (tagID == null) {
        tagID = this.#control.orphanIDs.pop() ?? this.#control.nextID++;
        this.#tagId2Name[tagID] = name;
        this.#tagName2Id.set(name, tagID);
      }

      return tagID;
    });

    tagIDs.length > 0
      ? this.#file2TagIDs[key] = tagIDs
      : delete this.#file2TagIDs[key];

    return this;
  }

  /**
   * Move entry tags from a path to another.
   * @param {string} oldPath Old entry key.
   * @param {string} newPath New entry key.
   * @return {boolean} Success.
   */
  moveEntry(oldPath, newPath) {
    const tagIDs = this.#file2TagIDs[oldPath];

    if (tagIDs != null) {
      this.#file2TagIDs[newPath] = tagIDs;
      delete this.#file2TagIDs[oldPath];
    }

    return tagIDs != null;
  }

  /**
   * Rename all specified tag occurrences.
   * @param {Map<string, string>} renameMap Old-new tag name key value map.
   * @returns {number} Entries updated.
   */
  renameTags(renameMap) {
    let entriesUpdated = 0;

    this.forEach((tags, key) => {
      // unique set of tags
      const updatedTags = /** @type {Set<string>} */ (new Set());
      let tagsRenamed = false;

      for (const tag of tags) {
        const renamedTag = renameMap.get(tag);

        if (renamedTag != null)
          tagsRenamed = true;

        updatedTags.add(renamedTag ?? tag);
      }

      if (tagsRenamed) {
        this.set(key, [...updatedTags]);
        entriesUpdated++;
      }
    });

    return entriesUpdated;
  }

  /**
   * Delete filepath from snapshot. Returns either entry existed before deletion.
   * - Super behavior preserved for meta entries.
   * @param {string} key Filepath
   * @returns {boolean}
   * @override
   */
  delete(key) {
    if ( TagState.#metaEntries.includes(key) )
      return super.delete(key);

    const existed = this.#file2TagIDs[key] != null;
    delete this.#file2TagIDs[key];
    return existed;
  }

  /**
   * Delete all occurrences of one or more tags.
   * @param {string[]} tags Tags to delete.
   * @returns {number} Entries updated.
   */
  deleteTags(tags) {
    const deletionTagSet = new Set(tags);
    let entriesUpdated = 0;

    this.forEach((entryTags, key) => {
      const tagSet = new Set(entryTags);
      const diffSet = tagSet.difference(deletionTagSet);

      if (tagSet.size > diffSet.size) {
        this.set(key, [...diffSet]);
        entriesUpdated++;
      }
    });

    return entriesUpdated;
  }

  /**
   * Clear state and meta structure.
   */
  clear() {
    super.clear();
    this.#generateMetaStructure();
    this.#tagName2Id.clear();
  }

  /**
   * Either filepath exists in snapshot.
   * - Super behavior preserved for meta entries.
   * @param {string} key Filepath
   * @returns {boolean}
   * @override
   */
  has(key) {
    if ( TagState.#metaEntries.includes(key) )
      return super.has(key);

    return this.#file2TagIDs[key] != null;
  }

  /**
   * Returns iterable filepaths.
   * @returns {MapIterator<string>}
   * @override
   */
  keys() {
    const filepaths = Object.keys(this.#file2TagIDs);
    return new Set(filepaths).keys();
  }

  /**
   * Returns iterable file tag-sets.
   * @returns {MapIterator<string[]>}
   * @override
   */
  values() {
    return this.solved().values();
  }

  /**
   * Returns iterable filepath, tag-set tuples.
   * - Prefer this over `[Symbol.iterator]` for regular consumption.
   * @returns {MapIterator<[string, string[]]>}
   * @override
   */
  entries() {
    return this.solved().entries();
  }

  /**
   * NOTE: Preserve [Symbol.iterator] for meta operations.
   */

  /**
   * Run callback once for each filepath, tag-set tuple.
   * @param {(value: string[], key: string, map:Map<string, string[]>)=>void} callback 
   * @param {any} [thisArg]
   * @override 
   */
  forEach(callback, thisArg) {
    this.solved().forEach(callback, thisArg);
  }

  /**
   * Return unique tags.
   * @returns {string[]}
   */
  uniqueTags() {
    return Object.values(this.#tagId2Name);
  }

  /**
   * Delete orphaned tags from storage.
   * @returns {Set<number>} Deleted tags.
   */
  deleteOrphanedTags() {
    const numberIDs = Object.keys(this.#tagId2Name).map(id => Number(id) );
    const tagIDs = new Set(numberIDs);
    const usedIDs = new Set( Object.values(this.#file2TagIDs).flat() );
    const unusedIDs = tagIDs.difference(usedIDs);

    unusedIDs.forEach(/** @param {number} id */ (id) => {
      this.#tagName2Id.delete(this.#tagId2Name[id]);

      this.#control.orphanIDs.push(id);
      delete this.#tagId2Name[id];
    });

    return unusedIDs;
  }

  /**
   * Returns solved representation of current snapshot.
   * - Filepath keys, tag-name array values.
   * - No custom state wrapper.
   * - No meta entries.
   * @returns {Map<string, string[]>}
   */
  solved() {
    const state = /** @type {Map<string, string[]>} */ ( new Map() );
    for (const file in this.#file2TagIDs) {
      const tags = this.#file2TagIDs[file].map(id => this.#tagId2Name[id]);
      state.set(file, tags);
    }

    return state;
  }
}


/**
 * Persistent tag storage.
 * @extends {JsonStorage<string[], TagState>}
 */
export class TagStorage extends JsonStorage {

  /**
   * Initialized persistent JSON filepath.
   */
  #storageFile = '';

  /**
   * Use MXIV tagDB filepath by default.
   * @param {String} storageFile Custom persistence file.
   */
  constructor(storageFile = tagDBFile) {
    super(storageFile, TagState, (state) => {
      if (state instanceof TagState)
        state.deleteOrphanedTags();
    });

    this.#storageFile = storageFile;
  }

  /**
   * Return information about current tag storage state.
   */
  async info() {
    const state = await this.getState();
    const fileCount = Object.keys( state.get(TagState.meta.files) ).length;
    const tagCount = Object.keys( state.get(TagState.meta.tags) ).length;

    return {
      storageFile: this.#storageFile,
      entryCount: fileCount,
      tagCount: tagCount
    };
  }

  /**
   * List database entries whose files are no longer accessible. Optionally clear orphans.
   * - Changes are persisted.
   * @param {boolean} [deleteOrphans=false] Either to delete orphaned entries if found.
   * @returns {Promise<string[]>} Orphaned entries.
   */
  async listOrphans(deleteOrphans = false) {
    const taskPromises = [], orphans = [];
    const state = await this.getState();

    for ( const filepath of state.keys() ) {
      taskPromises.push( new Promise(resolve => {
        access(filepath, (err) => {
          if (err != null) 
            orphans.push(filepath);

          resolve(true);
        });
      }));
    }

    await Promise.all(taskPromises);

    if (deleteOrphans && orphans.length > 0) {
      await this.write(db => {
        for (const key of orphans)
          db.delete(key);
      });
    }

    return orphans;
  }
}
