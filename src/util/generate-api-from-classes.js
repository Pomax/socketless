import { getAllFunctions } from "./get-all-functions.js";
import { register } from "./register.js";

/**
 * API abstraction function that takes the two classes,
 * and turns it into a namespaced API object.
 */
export function generateAPIfromClasses(ClientClass, ServerClass, API = {}) {
  getAllFunctions(ClientClass).forEach((name) => register(API, "client", name));
  getAllFunctions(ServerClass).forEach((name) => register(API, "server", name));
  return API;
}
