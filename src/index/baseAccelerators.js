import { AcceleratorController } from "../actions/acceleratorController.js";


AcceleratorController.setBaseDefaults({

  // cmds
  'x': ['cli', 'show'],
  'r+Shift': ['cli', 'repeatLast'],
  'l+Control': ['cli', 'clear'],
  'f+Shift': ['cli', 'show', 'find '],
  'f+Control': ['cli', 'show', 'filter '],

  // app
  'h': ['statusVisibility'],
  'g': ['tab', 'new', 'library'],
  'n': ['newWindow'],

  // tab control
  't+Control': ['tab', 'new'],
  'Tab+Control': ['tab', 'cycle'],
  'Tab+Control+Shift': ['tab', 'cycle', 'back'],
  'd+Control': ['tab', 'close'],
  't+Shift': ['tab', 'duplicate'],
  't': ['tab', 'visibility'],
  'w+Shift': ['tab', 'move'],
  's+Shift': ['tab', 'move', 'left'],
  
});
