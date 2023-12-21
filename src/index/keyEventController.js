import { FRAME } from "../app/tabs.js"
import { AppCLI } from "../app/appCLI.js"
import { ActionDB } from "../app/actionDB.js"
import { AcceleratorDB } from "../app/acceleratorDB.js"


// catch and treat keydown events for accelerators
onkeydown = (e) => {

  // block input on null FRAME & AppCLI active (until Escape is pressed).
  if (!FRAME) return
  if (AppCLI.active) return AppCLI.toggle(e.key != 'Escape')

  const frameAccel = AcceleratorDB.currentFrameAccelerator
  const action = frameAccel.byEvent(e)
  if (!action) return

  e.preventDefault()
  ActionDB.currentFrameActions.run(action)
  
}