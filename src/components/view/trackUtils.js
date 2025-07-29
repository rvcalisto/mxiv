// @ts-check

/**
 * Get HH:MM:SS string from seconds.
 * @param {number} seconds 
 * @returns {string} Formatted time string.
 */
export function secToHMS(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor(seconds % 3600 / 60);
  const s = Math.floor(seconds % 3600 % 60);
  
  const H = h ? String(h).padStart(2, '0') : '00';
  const M = m ? String(m).padStart(2, '0') : '00';
  const S = s ? String(s).padStart(2, '0') : '00';
  
  return `${H}:${M}:${S}`;
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
