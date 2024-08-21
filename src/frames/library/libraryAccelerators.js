import { AcceleratorService } from "../../actions/acceleratorService.js"


AcceleratorService.setComponentDefaults('library', {
  
  'o'   : ['addToLibrary'],
  'r'   : ['random'],
  'F5'  : ['watchlist', 'sync'],
  'Escape' : ['watchlist', 'close'],

  'Space'         : ['book', 'open'],
  'Shift+Space'   : ['book', 'open', 'newTab'],

  'x' : ['palette', 'show'],
  'f' : ['palette', 'show', 'filter '],
  't' : ['palette', 'show', 'tag add '],
  'u' : ['palette', 'show', 'tag del '],
  'Shift+r'   : ['palette', 'repeatLast'],
  'Control+l' : ['palette', 'clear'],
  
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

