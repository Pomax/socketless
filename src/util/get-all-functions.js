// helper function to find all declared class functions
// all the way up to the Object chain.
export function getAllFunctions(objectClass) {
  const functions = [];

  while (objectClass.prototype) {
    const proto = objectClass.prototype;

    // This filter function determines whether a function signature
    // constitutes a namespaced socketless function or not.
    const verify = (v) => {
      let fn = proto[v];
      if (typeof fn !== `function`) return false;
      if (fn.toString().indexOf(`async`) !== 0) return false;
      let m = v.match(/\w+[$:]\w+/);
      return !!m;
    };

    // get all socketless functions
    Object.getOwnPropertyNames(proto)
      .filter(verify)
      .forEach((name) => {
        // If we've already seen a binding for this function name, then that
        // binding was for a subclass overriding a superclass function, and
        // we should ignore this new binding.
        if (functions.indexOf(name) > -1) return;
        // If not, record it.
        functions.push(name);
      });

    // "Recurse": run through the parent class
    objectClass = objectClass.__proto__;
  }

  return functions;
}
