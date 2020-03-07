const getAllFunctions = require("./get-all-functions.js");
const register = require("./register.js");

/**
 * API abstraction function that takes the two classes,
 * and turns it into a namespaced API object.
 */
module.exports = function generateAPIfromClasses(
  ClientClass,
  ServerClass,
  API = {}
) {
  getAllFunctions(ClientClass).forEach(name => register(API, "client", name));
  getAllFunctions(ServerClass).forEach(name => register(API, "server", name));
  return API;
};
