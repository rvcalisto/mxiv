import { FRAME } from "../tabs/tab.js";
import { getActions } from "../actions/actionService.js";
import { getAccelerators } from "../actions/acceleratorService.js";


/**
 * @import { GenericFrame } from "./genericFrame.js"
 * @import { ComponentActions } from "../actions/componentActions.js"
 * @import { ComponentAccelerators } from "../actions/componentAccelerators.js"
 */


/**
 * Return current context frame, actions and accelerators.
 * - Assumes frame and components are correct.
 */
export function getFrameContext() {
  let frame, actions, accelerators;

  frame = /** @type {GenericFrame} */ (FRAME);
  actions = /** @type {ComponentActions} */ (getActions(frame.type));
  accelerators = /** @type {ComponentAccelerators} */ (getAccelerators(frame.type));

  return { frame, actions, accelerators };
}
