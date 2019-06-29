/**
 * You might think to use JSON.parse(JSON.stringify),
 * but JSON.stringify throws when it finds a cyclic
 * binding, and we literally don't care if what we're
 * interested in is a state representation (i.e. a
 * representation of the object as data, with all
 * the functions stripped).
 *
 * We're not string-serializing, just state-extracting.
 */
module.exports = function getState(object, removals) {
    let state = {};
    Object.getOwnPropertyNames(object).forEach(key => {
        if (removals.indexOf(key) !== -1) return;
        let value = object[key];
        if (typeof value !== "function") {
            state[key] = value;
        }
    });
    return state;
};
