// @ts-check
import palette from "../components/actionPalette/actionPalette.js";
import { getCurrentActions } from "../actions/actionService.js";
import { getCurrentAccelerators } from "../actions/acceleratorService.js";


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
    getCurrentActions().run(action);
  }
};

addEventListener('keydown', frameKeyEvHandler);
