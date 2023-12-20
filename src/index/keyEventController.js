import { FRAME } from "../app/tabs.js"
import { AppCLI } from "../app/appCLI.js"
import { Accelerators, Actions } from "../app/actionTools.js"


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