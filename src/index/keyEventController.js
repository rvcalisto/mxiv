import { FRAME } from "../tabs/tab.js";
import { AppCLI } from "../components/appCli/appCLI.js";
import { ActionService } from "../actions/actionService.js";
import { AcceleratorService } from "../actions/acceleratorService.js";


// catch and treat keydown events for accelerators
onkeydown = (e) => {
  // block input on null FRAME & AppCLI active (until Escape is pressed).
  if (FRAME == null) return;
  if (AppCLI.active) return AppCLI.toggle(e.key !== 'Escape');
  
  const action = AcceleratorService.currentFrameAccelerators.byEvent(e);
  if (action != null) {
    e.preventDefault();
    ActionService.currentFrameActions.run(action);
  }
}