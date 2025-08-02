import { setBaseAccelerators } from "../actions/acceleratorService.js";


setBaseAccelerators({
  // cmds
  'x': ['palette', 'show'],
  'r+Shift': ['palette', 'repeatLast'],
  'l+Control': ['palette', 'clear'],
  'f+Shift': ['palette', 'show', 'find'],
  'f+Control': ['palette', 'show', 'filter'],

  // app
  'h': ['statusVisibility'],
  'g': ['tab', 'new', 'library'],
  'n': ['newWindow'],
  'f11': ['fullscreen'],

  // tab control
  't+Control': ['tab', 'new'],
  'Tab+Control': ['tab', 'cycle'],
  'Tab+Control+Shift': ['tab', 'cycle', 'back'],
  'd+Control': ['tab', 'close'],
  't+Shift': ['tab', 'duplicate'],
  't': ['tab', 'visibility'],
  'w+Shift': ['tab', 'move'],
  's+Shift': ['tab', 'move', 'left']
});
