// helper function to find all declared class functions
// all the way up to the Object chain.
module.exports = function getAllFunctions(objectClass) {
  const functions = [];

  while (objectClass.prototype) {
    const proto = objectClass.prototype;

    const verify = v => {
      let fn = proto[v];
      if (typeof fn !== `function`) return false;
      if (fn.toString().indexOf(`async`) !== 0) return false;
      let m = v.match(/[$:]/);
      if (!m) return false;
      return m.index > 0;
    };

    Object.getOwnPropertyNames(proto)
      .filter(verify)
      .forEach(name => {
        if (functions.indexOf(name) > -1) {
          // If we've already seen a binding for this function name, then that
          // binding was for a subclass overriding a superclass function, and
          // we should ignore this new binding.
        } else functions.push(name);
      });

    objectClass = objectClass.__proto__;
  }

  return functions;
};
