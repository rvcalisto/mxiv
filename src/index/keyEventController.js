import { FRAME } from "../tabs/tab.js";
import { AppCLI } from "../components/appCli/appCLI.js";
import { ActionController } from "../actions/actionController.js";
import { AcceleratorController } from "../actions/acceleratorController.js";


// catch and treat keydown events for accelerators
onkeydown = (e) => {
  // block input on null FRAME & AppCLI active (until Escape is pressed).
  if (FRAME == null) return;
  if (AppCLI.active) return AppCLI.toggle(e.key !== 'Escape');
  
  const action = AcceleratorController.currentFrameAccelerators.byEvent(e);
  if (action != null) {
    e.preventDefault();
    ActionController.currentFrameActions.run(action);
  }
}