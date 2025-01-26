import { FRAME } from "../tabs/tab.js";
import { actionPalette } from "../components/actionPalette/actionPalette.js";
import { actionService } from "../actions/actionService.js";
import { acceleratorService } from "../actions/acceleratorService.js";


// catch and treat keydown events for accelerators
onkeydown = (e) => {
  // FRAME may be null early on new window
  if (FRAME == null)
    return;

  // focus actionPalette if open (until Escape is pressed)
  if (actionPalette.active)
    return actionPalette.toggle(e.key !== 'Escape');
  
  const action = acceleratorService.currentFrameAccelerators.byEvent(e);
  if (action != null) {
    e.preventDefault();
    actionService.currentFrameActions.run(action);
  }
}
