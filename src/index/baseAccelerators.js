import { setBaseAccelerators } from "../actions/acceleratorService.js";


setBaseAccelerators({
  // cmds
  'x': ['palette', 'show'],
  'r+Shift': ['palette', 'repeatLast'],
  'l+Control': ['palette', 'clear'],
  'f+Shift': ['palette', 'show', 'find'],
  'f+Control': ['palette', 'show', 'filter'],

  // app
  'g': ['tab', 'new', 'library'],
  'n': ['window', 'new'],
  't': ['window', 'toggleTabs'],
  'h': ['window', 'toggleStatus'],
  'f11': ['window', 'toggleFullscreen'],

  // tab control
  't+Control': ['tab', 'new'],
  'Tab+Control': ['tab', 'cycle'],
  'Tab+Control+Shift': ['tab', 'cycle', 'back'],
  'd+Control': ['tab', 'close'],
  't+Shift': ['tab', 'duplicate'],
  'w+Shift': ['tab', 'move'],
  's+Shift': ['tab', 'move', 'left']
});
