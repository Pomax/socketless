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

// Convert an object's leaves to `true` flags
export function convertToChangeFlags(initialState) {
  // @ts-ignore because this function only runs in browser context,
  //            which will have rfc6902 available as a global.
  const diff = rfc6902.createPatch({}, initialState);
  return diffToChangeFlags(diff);
}

// Convert an RFC6902 diff patch into a change flag object
export function diffToChangeFlags(diff) {
  const changeFlags = {};
  diff.forEach(({ path, value }) => {
    let lvl = changeFlags;
    const parts = path.split(`/`);
    parts.shift(); // path starts with a leading slash
    if (parts.at(-1) === `-`) parts.pop(); // is this an array push?
    while (parts.length > 1) {
      const part = parts.shift();
      lvl = lvl[part] ??= {};
    }
    if (typeof value === `object`) {
      lvl[parts[0]] = JSON.parse(
        JSON.stringify(value, (k, v) => {
          if (typeof v !== `object` || v instanceof Array) return true;
          return v;
        }),
      );
    } else {
      lvl[parts[0]] = true;
    }
  });
  return changeFlags;
}
