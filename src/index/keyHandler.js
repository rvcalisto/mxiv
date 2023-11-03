import { FRAME } from "../app/tabs.js"
import { Accelerators, Actions } from "../app/actionTools.js"
import { AppCLI } from "../app/appCLI.js"
import "./baseActions.js"

// '<keyCombo>' : ['<action>', '<arg>']
Accelerators.register('base', {

	// cmds
	'x'         : ['cli', 'show'],
	'r+Shift'   : ['cli', 'repeatLast'],
  'l+Control' : ['cli', 'clear'],
  'f+Shift'   : ['cli', 'show', 'find '],
  'f+Control' : ['cli', 'show', 'filter '],

	// app
	'h' : ['statusVisibility'],
  'g' : ['tab', 'new', 'library'],
  'n' : ['newWindow'],

  // tab control
  't+Control' : ['tab', 'new'],
  'Tab+Control' : ['tab', 'cycle'],
  'Tab+Control+Shift' : ['tab', 'cycle', 'back'],
  'd+Control' : ['tab', 'close'],
  't+Shift' : ['tab', 'duplicate'],
  't' : ['tab', 'visibility'],
  'w+Shift' : ['tab', 'move'],
  's+Shift' : ['tab', 'move', 'left'],
  
})

// catch and treat keydown events for accelerators
onkeydown = (e) => {
  // block input on null FRAME & AppCLI active (until Escape is pressed).
  if (!FRAME) return
  if (AppCLI.active) return AppCLI.toggle(e.key != 'Escape')

  const frameComponent = `${FRAME.constructor.name.toLowerCase()}-all`
  const action = Accelerators.byEvent(frameComponent, e)
  if (!action) return

  e.preventDefault()
  Actions.run(frameComponent, action)
}