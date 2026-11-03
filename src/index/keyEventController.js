import palette from "../components/actionPalette/actionPalette.js";
import { getFrameContext } from "../frames/frameContext.js";
import { notify } from "../components/notifier.js";


/**
 * Main handler for frame keyboard events.
 * @param {KeyboardEvent} e
 */
export function frameKeyEvHandler(e) {
  // focus actionPalette if open (until Escape is pressed)
  if (palette.paletteIsVisible)
    return palette.togglePalette(e.key !== 'Escape');

  const context = getFrameContext();
  if (context.frame == null)
    return;

  const action = context.accelerators.byEvent(e);
  if (action == null)
    return;

  e.preventDefault();
  if ( context.actions.run(context.frame, action) )
    return;

  context.actions.getGroups().has(action[0])
    ? notify(`"${action[1]}" isn't a "${action[0]}" action in current context`, 'runAct')
    : notify(`"${action[0]}" isn't an action nor group in current context`, 'runAct');
}


addEventListener('keydown', frameKeyEvHandler);
