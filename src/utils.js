/*
  this file exists purely because it's *way* too easy to typo a
  string and then spend an hour trying to figure out why things
  don't work, only to discover you forgot an "s" or added and
  extra "e" somewhere.
*/

export const SERVER = `server`;
export const CLIENT = `client`;
export const WEBCLIENT = `webclient`;
export const BROWSER = `browser`;

export function deepCopy(obj) {
  if (obj === undefined) return obj;
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (e) {
    console.error(`Could not round-trip object via JSON:`, obj);
    throw e;
  }
}
