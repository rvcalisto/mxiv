import { AcceleratorDB } from "../../actions/acceleratorDB.js";
import { AppCLI } from "./appCLI.js";


/**
 * Descriptive option object for display in AppCmdLine.
 * @typedef CmdOption
 * @property {String} name Option name.
 * @property {String} desc Option description.
 * @property {'action'|'history'|'generic'|?} type Option type.
 * @property {false} replace Either if to completely replace prompt or complement.
 */

/**
 * Returns rich option object to be displayed by AppCmdLine.
 * @param {String} name Option name.
 * @param {String} desc Option description.
 * @param {'action'|'history'|'generic'|?} type Option type.
 * @param {false} replace Either if to completely replace prompt or complement.
 * @returns {CmdOption}
 */
export function option(name, desc = '', type = 'generic', replace = false) {
  return {
    name: name,
    desc: desc,
    type: type,
    replace: replace
  };
}

/**
 * Returns a HTMLElement from option object.
 * @param {CmdOption} item Option object.
 * @returns {HTMLElement}
 */
export function optionElement(item) {
  const optElement = document.createElement('div');
  optElement.hint = item; // set reference
  optElement.setAttribute('icon', item.type);

  const text = document.createElement('p');
  text.className = 'itemText';
  text.textContent = item.name;

  // description to be applied as atribute for css ::after 
  if (item.desc) text.setAttribute('desc', item.desc);
  optElement.append(text);

  // decorators / buttons
  if (item.type === 'action') {
    const element = acceleratorHints([item.name])
    if (element) optElement.append(element)
  } 
  else if (item.type === 'history') {
    optElement.append( forgetFromHistory(optElement) )
  }

  return optElement;
}

/**
 * Returns HTMLElement for keys accelerating this given action. Null if none found.
 * @param {String[]} action Action array.
 * @returns {HTMLElement?} 
 */
function acceleratorHints(action) {
  const frameAccelSet = AcceleratorDB.currentFrameAccelerator;
  const acceleratedBy = frameAccelSet.byAction(action);

  if (acceleratedBy.length < 1) return null

  const element = document.createElement('div');
  element.className = 'accelerators';

  acceleratedBy.forEach(key => {
    const hotkey = document.createElement('p');
    hotkey.className = 'itemTag';
    hotkey.textContent = key;
    element.appendChild(hotkey);
  });

  return element
}

/**
 * Returns HTMLButtonElement to remove given option from history.
 * @param {HTMLElement} hostOption Option HTMLElement
 * @returns {HTMLButtonElement}
 */
function forgetFromHistory(hostOption) {
  const element = document.createElement('button');
  element.className = 'itemTag';
  element.textContent = 'forget'; // '✖️'

  element.onclick = (e) => {
    AppCLI.clearCmdHistory(hostOption.hint.name);
    hostOption.remove();
    
    AppCLI.toggle(true);
    e.stopImmediatePropagation();
  };

  return element
}