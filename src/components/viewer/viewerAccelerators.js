import { Accelerators } from "../../app/actionTools.js"


Accelerators.register('viewer', {
	// navigation
	'w' : ['navigate', 'up'],
	's' : ['navigate', 'down'],
	'a' : ['navigate', 'left'],
	'd' : ['navigate', 'right'],
  
  // same for arrow keys
  'ArrowUp'    : ['navigate', 'up'],
  'ArrowDown'  : ['navigate', 'down'],
  'ArrowLeft'  : ['navigate', 'left'],
  'ArrowRight' : ['navigate', 'right'],

	// image
	'e'       : ['viewFactor', 'cycle', 'next'],
  'e+Shift' : ['viewFactor', 'cycle', 'back'],
	'z'       : ['zoom', '+10'],
	'z+Shift' : ['zoom', '-10'],
	'Space+Shift' : ['scrollTo', 'top'],
  'Control+Space' : ['scrollTo', 'bottom'],
  'r' : ['random'],

	// video
	'Space' : ['pause'],
	'm' : ['mute'],
	'l' : ['loop'],
	'd+Shift' : ['flipPage', 'next'],
	'a+Shift' : ['flipPage', 'back'],
  '0' : ['setVolume', '+5'],
  '9' : ['setVolume', '-5'],
  '.' : ['navigate', 'right', '0', '.05'], // poor man's frame-by-frame :P
  ',' : ['navigate', 'left', '0', '.05'],

	// app
	'f' : ['fullscreen'],
	'F5' : ['reload'],
  'j' : ['fileExplorer', 'mode', 'playlist'],
  'o' : ['fileExplorer', 'mode', 'explorer'],
  'Tab' : ['fileExplorer', 'toggleFocus'],
  'Delete' : ['delete'],
  
})

// to be managed by local controller
Accelerators.register('fileExplorer', {
  'w' : ['navItems', 'up'],
  'ArrowUp' : ['navItems', 'up'],

  's' : ['navItems', 'down'],
  'ArrowDown' : ['navItems', 'down'],

  'a' : ['backOneFolder'],
  'ArrowLeft' : ['backOneFolder'],
  
  'd' : ['select'],
  'ArrowRight' : ['select'],

  'f' : ['toggleSearch'],
})