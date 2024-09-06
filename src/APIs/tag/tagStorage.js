// @ts-check
import { JsonStorage } from '../tool/jsonStorage.js';
import { tagDBFile } from '../tool/appPaths.js';
import fs from 'fs';


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
  #tagId2Name = super.get(TagState.meta.tags);

  /**
   * Inverted `#tagIdName` table for reverse search. Virtual, not persisted.
   * @type {Map<string, number>}
   */
  #tagName2Id = new Map();
  
  /**
   * File Path -> Tag-IDs table.
   * @type {Object<string, number[]>}
   */
  #file2TagIDs = super.get(TagState.meta.files);

  /**
   * Control properties.
   * @type {{nextID: number, orphanIDs: number[]}}
   */
  #control = super.get(TagState.meta.control);

  /**
   * Initialize meta entries.
   * @param  {...any} args 
   */
  constructor(...args) {
    super(...args);

    if (!this.#file2TagIDs) {
      super.set(TagState.meta.files, {});
      this.#file2TagIDs = super.get(TagState.meta.files);
    }

    if (!this.#tagId2Name) {
      super.set(TagState.meta.tags, {});
      this.#tagId2Name = super.get(TagState.meta.tags);
    }

    if (!this.#control) {
      super.set(TagState.meta.control, {
        nextID: 0,
        orphanIDs: []
      });

      this.#control = super.get(TagState.meta.control);
    }
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

    const tagIDs = value.map(name => {
      let tagID = this.#tagName2Id.get(name);

      if (tagID == null) {
        tagID = this.#control.orphanIDs.pop() || this.#control.nextID++;
        this.#tagId2Name[tagID] = name;
        this.#tagName2Id.set(name, tagID);
      }

      return tagID;
    });

    tagIDs.length > 0 ?
      this.#file2TagIDs[key] = tagIDs :
      delete this.#file2TagIDs[key];

    return this;
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

  clear() {
    super.clear();
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
   * @returns {IterableIterator<string>}
   * @override
   */
  keys() {
    const filepaths = Object.keys(this.#file2TagIDs);
    return new Set(filepaths).keys();
  }

  /**
   * Returns iterable file tag-sets.
   * @returns {IterableIterator<string[]>}
   * @override
   */
  values() {
    return this.solved().values();
  }

  /**
   * Returns iterable filepath, tag-set tuples.
   * - Prefer this over `[Symbol.iterator]` for regular consumption.
   * @returns {IterableIterator<[string, string[]]>}
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
    console.time('computeUniqueTags');
    const tagNames = Object.values(this.#tagId2Name);
    console.timeEnd('computeUniqueTags');
    
    return tagNames;
  }

  /**
   * Delete orphaned tags from storage.
   * @returns {Set<number>} Deleted tags.
   */
  deleteOrphanedTags() {
    // console.time('delete orphaned tag');
    const numberIDs = Object.keys(this.#tagId2Name).map(id => Number(id) );
    const tagIDs = new Set(numberIDs);
    const usedIDs = new Set( Object.values(this.#file2TagIDs).flat() );
    const unusedIDs = tagIDs.difference(usedIDs);

    unusedIDs.forEach(/** @param {number} id */ (id) => {
      this.#tagName2Id.delete(this.#tagId2Name[id]);

      this.#control.orphanIDs.push(id);
      delete this.#tagId2Name[id];
    });
    // console.timeEnd('delete orphaned tag');

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
    // console.time('deserialize tags');
    const state = /** @type {Map<string, string[]>} */ ( new Map() );
    for (const file in this.#file2TagIDs) {
      const tags = this.#file2TagIDs[file].map(id => this.#tagId2Name[id]);
      state.set(file, tags);
    }
    // console.timeEnd('deserialize tags');

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
    super(storageFile, TagState);
    this.#storageFile = storageFile;
  }

  /**
   * Upgrade old storage structure when applicable.
   * - TODO: Remove later.
   * @returns {Promise<void>}
   */
  async upgradeStructure() {
    await new Promise(resolve => {
      fs.readFile(this.#storageFile, 'utf8', async (err, text) => {
        const storageObject = !err && JSON.parse(text);

        if (!err && storageObject._control == null) {
          console.time('MXIV: Upgraded TagDB structure');
          
          const newState = new TagState();
          const oldState = new Map( Object.entries(storageObject) );

          oldState.forEach( (tags, filepath) => newState.set(filepath, tags) );
          await this.setState(newState);

          console.timeEnd('MXIV: Upgraded TagDB structure');
        }
        
        resolve(true);
      });
    });
  }

  /**
   * @override
   * Clean orphaned tags before persisting.
   * @param {Map<string>|TagState} state 
   */
  async setState(state) {
    if (state instanceof TagState)
      state.deleteOrphanedTags();

    return await super.setState(state);
  }

  /**
   * Return information about current tag storage state.
   */
  async info() {
    const state = await this.getState(true);
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
   * * Changes are persisted.
   * @param {boolean} [deleteOrphans=false] Either to delete orphaned entries if found.
   */
  async listOrphans(deleteOrphans = false) {
    const taskPromises = [], orphans = [];
    const state = await this.getState(true);

    for ( const filepath of state.keys() ) {
      taskPromises.push( new Promise(resolve => {
        fs.access(filepath, (err) => {
          if (err) 
            orphans.push(filepath);

          resolve(true);
        });
      }));
    }

    await Promise.all(taskPromises);
    
    if (orphans.length < 1) {
      console.log('\nNo orphan entries to clean.');
    } else {
      console.log(`${orphans.length} orphan entries found:`, orphans);

      if (deleteOrphans) {
        await this.write(db => {
          for (const key of orphans)
            db.delete(key);
        });
        
        console.log('Cleaned', orphans.length, 'orphan entries.');
      }
    }
  }
}
