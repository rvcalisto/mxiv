import { FRAME } from "../tabs/tab.js"
import { AppCLI } from "../components/appCli/appCLI.js"
import { ActionDB } from "../actions/actionDB.js"
import { AcceleratorDB } from "../actions/acceleratorDB.js"


// catch and treat keydown events for accelerators
onkeydown = (e) => {
  // block input on null FRAME & AppCLI active (until Escape is pressed).
  if (FRAME == null) return
  if (AppCLI.active) return AppCLI.toggle(e.key !== 'Escape')
  
  const action = AcceleratorDB.currentFrameAccelerator.byEvent(e)
  if (action != null) {
    e.preventDefault()
    ActionDB.currentFrameActions.run(action)
  }
}