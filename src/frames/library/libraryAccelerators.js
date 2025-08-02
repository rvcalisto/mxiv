import { setComponentAccelerators } from "../../actions/acceleratorService.js"


setComponentAccelerators('library', {
  'o'   : ['addToLibrary'],
  'r'   : ['random'],
  'F5'  : ['watchlist', 'sync'],
  'Escape' : ['watchlist', 'panel', 'close'],

  'Space'         : ['book', 'open'],
  'Shift+Space'   : ['book', 'open', 'newTab'],

  'f' : ['palette', 'show', 'filter'],
  't' : ['palette', 'show', 'tag add'],
  'u' : ['palette', 'show', 'tag del'],
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
  's'         : ['moveSelection', 'vertically', 'next']
});
