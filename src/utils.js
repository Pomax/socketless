export const SERVER = `server`;
export const CLIENT = `client`;
export const WEBCLIENT = `webclient`;
export const BROWSER = `browser`;

export function deepCopy(obj) {
  if (obj === undefined) return obj;
  try {
    // Counter-intuitively, this is faster than structuredClone()
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
  return patchToChangeFlags(diff);
}

// Convert an RFC6902 diff patch into a change flag object
export function patchToChangeFlags(patch) {
  const changeFlags = {};
  const opCodes = {
    add: 1,
    replace: 2,
    remove: 3,
    addArray: 4,
    replaceArray: 5,
    removeArray: 6,
  };
  patch.forEach(({ op, path, value }) => {
    let lvl = changeFlags;
    const parts = path.split(`/`);
    parts.shift(); // path starts with a leading slash
    let suffix = parts.at(-1) === `-` ? `Array` : ``;
    if (suffix) parts.pop(); // is this an array push?
    while (parts.length > 1) {
      const part = parts.shift();
      lvl[part] ??= {};
      lvl = lvl[part];
    }
    if (typeof value === `object`) {
      value = JSON.parse(
        JSON.stringify(value, (k, v) => {
          if (typeof v !== `object` || v instanceof Array) {
            return opCodes[op + suffix];
          }
          return v;
        }),
      );
      // if this is a number already, overwrite it.
      if (lvl[parts[0]] === undefined || typeof lvl[parts[0]] === `number`) {
        lvl[parts[0]] = value;
      }
    } else {
      const prop = parts[0];
      // explicit coercion to check if this is an integer
      if (parseInt(prop) == prop) suffix = `Array`;
      // And then only assign if this isn't "something" already.
      lvl[parts[0]] ??= opCodes[op + suffix];
    }
  });
  return changeFlags;
}
