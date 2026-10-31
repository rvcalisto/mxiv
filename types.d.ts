/**
 * CSS import attribute.
 */
declare module '*.css' {
  const css: CSSStyleSheet;
  export default css;
}


/**
 * MXIVElectronAPI `dialog` type and corresponding return values.
 */
interface DialogTypeMap {
  'open': string[];
  'message': number;
}


/**
 * MXIV Electron context methods.
 */
declare interface MXIVElectronAPI {
  
  // coordination
  requestLock: (lock: string) => Promise<boolean>;
  releaseLock: (lock: string) => Promise<boolean>;
  broadcast: (message: string, ...args: any[]) => Promise<void>;
  onBroadcast: (callback: (message: string, ...args: any[]) => void) => void;
  
  // library
  addToLibrary: (items: { path: string, recursive: boolean }[]) => Promise<number>;
  updateLibraryThumbnails: () => Promise<void>;
  getLibraryEntries: () => Promise<any[]>;
  removeFromLibrary: (path: string) => Promise<boolean>;
  clearLibrary: () => Promise<boolean>;
  onLibraryNew: (callback: (entry: any) => void) => void;
  
  // open files
  openFile: (paths: string[], ownerID: string) => Promise<any>;
  clearTmp: (ownerID: string) => Promise<void>;
  clearCache: () => void;
  
  // operate on file
  getFileURL: (path: string) => string,
  runOnFile: (userScript: string, currentFile: string | undefined) => Promise<boolean>;
  deleteFile: (path: string) => Promise<boolean>;
  getPathForFile: (file: File) => string;
  
  // discover files
  queryPath: (path: string) => Promise<string[]>;
  scanPath: (path: string) => Promise<any>;
  
  // manage file tags
  uniqueTags: () => string[];
  getTags: (path: string) => string[];
  addTags: (path: string, ...tags: string[]) => Promise<number>;
  removeTags: (path: string, ...tags: string[]) => Promise<number>;
  renameTags: (...tags: string[]) => Promise<number>;
  deleteTags: (...tags: string[]) => Promise<number>;
  
  // app window
  newWindow: () => Promise<void>;
  dialog: <T extends keyof DialogTypeMap>(type: T, options: object) => Promise<DialogTypeMap[T]>;
  onOpen: (callback: (details: any) => void) => void;
  toggleFullscreen: () => Promise<boolean>;
  onFullscreen: (callback: (isFullscreen: boolean) => void) => void;
  setTheme: (theme: string) => Promise<void>;
}


/**
 * Custom Electron APIs.
 */
declare const elecAPI: MXIVElectronAPI;
