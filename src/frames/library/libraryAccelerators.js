import { AcceleratorController } from "../../actions/acceleratorController.js"


AcceleratorController.setComponentDefaults('library', {
  
  'o'   : ['addToLibrary'],
  'r'   : ['random'],
  'F5'  : ['watchlist', 'sync'],
  'Escape' : ['watchlist', 'close'],

  'Space'         : ['book', 'open'],
  'Shift+Space'   : ['book', 'open', 'newTab'],

  'x' : ['cli', 'show'],
  'f' : ['cli', 'show', 'filter '],
  't' : ['cli', 'show', 'tag add '],
  'u' : ['cli', 'show', 'tag del '],
  'Shift+r'   : ['cli', 'repeatLast'],
  'Control+l' : ['cli', 'clear'],
  
  // horizontal navigation
  'ArrowRight' : ['moveSelection', 'horizontally', 'next'],
  'd'          : ['moveSelection', 'horizontally', 'next'],
  'ArrowLeft'  : ['moveSelection', 'horizontally', 'back'],
  'a'          : ['moveSelection', 'horizontally', 'back'],

  // vertical navigation
  'ArrowUp'   : ['moveSelection', 'vertically', 'back'],
  'w'         : ['moveSelection', 'vertically', 'back'],
  'ArrowDown' : ['moveSelection', 'vertically', 'next'],
  's'         : ['moveSelection', 'vertically', 'next'],
})

