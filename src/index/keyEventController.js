// @ts-check
import palette from "../components/actionPalette/actionPalette.js";
import { getCurrentActions } from "../actions/actionService.js";
import { getCurrentAccelerators } from "../actions/acceleratorService.js";
import { notify } from "../components/notifier.js";


/**
 * Main handler for frame keyboard events.
 * @param {KeyboardEvent} e
 */
export function frameKeyEvHandler(e) {
  // focus actionPalette if open (until Escape is pressed)
  if (palette.paletteIsVisible)
    return palette.togglePalette(e.key !== 'Escape');

  const action = getCurrentAccelerators().byEvent(e);
  if (action != null) {
    e.preventDefault();

    const frameActions = getCurrentActions();
    if ( !frameActions.run(action) ) {
      frameActions.getGroups().has(action[0])
        ? notify(`"${action[1]}" isn't a "${action[0]}" action in current context`, 'runAct')
        : notify(`"${action[0]}" isn't an action nor group in current context`, 'runAct');
    }
  }
};

addEventListener('keydown', frameKeyEvHandler);
