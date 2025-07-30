// @ts-check

/**
 * Get HH:MM:SS string from seconds.
 * @param {number} seconds
 * @param {boolean} [shorten=false] Cut leading zeros.
 * @returns {string} Formatted time string.
 */
export function secToHMS(seconds, shorten = false) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor(seconds % 3600 / 60);
  const s = Math.floor(seconds % 3600 % 60);
  
  const H = h ? String(h).padStart(2, '0') : '00';
  const M = m ? String(m).padStart(2, '0') : '00';
  const S = s ? String(s).padStart(2, '0') : '00';
  
  const hhMmSs = `${H}:${M}:${S}`;

  if (!shorten)
    return hhMmSs;

  let toDiscard = 0;
  for (const char of hhMmSs) {
    if (hhMmSs.length - toDiscard === 4)
      break; // assure at least a single minute digit (0:10)
    if (char === '0' || char === ':')
      toDiscard++;
    else
      break;
  }

  return hhMmSs.slice(toDiscard);
}

/**
 * Get seconds from HH:MM:SS string.
 * @param {string} HMS `HH:MM:SS.ms` like formatted string.
 * @returns {number}
 */
export function HMStoSec(HMS) {
  const [ seconds = '00', minutes = '00', hours = '00'] = HMS
    .split(':').reverse();

  return ( parseInt(hours) * 3600 ) 
       + ( parseInt(minutes) * 60 ) 
       + ( parseFloat(seconds)    );
}
