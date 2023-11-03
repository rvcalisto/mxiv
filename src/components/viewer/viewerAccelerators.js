import { Accelerators } from "../../app/actionTools.js"
import { FRAME } from "../../app/tabs.js"


// '<keyCombo>' : ['<action>', '<arg>']
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

// keyEvents dispatched from fileExplorer
addEventListener('fileExplorerKeyEvent', function handleFileExplorer(e) {
  const keyEvent = e.detail
  const action = Accelerators.byEvent('fileExplorer', keyEvent)

  // no match, bubble up
  if (!action) return onkeydown(keyEvent)

  keyEvent.preventDefault()
  const [cmd, ...args] = action

  FRAME.fileExplorer[cmd](...args)
})

// release slide state for Viewer frames (workaround)
addEventListener('keyup', function releaseViewSlide(e) {
  if (!FRAME || FRAME.constructor.name !== 'Viewer') return
  
  const action = Accelerators.byEvent('viewer', e)
  if (!action) return

  // else, run action
  e.preventDefault()
  const cmd = action[0]
  if (cmd !== 'navigate') return

  const axis = action[1]
  if (['left', 'right'].includes(axis)) FRAME.viewComponent.navigate('x', 0)
  else if (['up', 'down'].includes(axis)) FRAME.viewComponent.navigate('y', 0)
})