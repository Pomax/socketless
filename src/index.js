import { generateAPIfromClasses } from "./util/generate-api-from-classes.js";
import { ClientServerFactory } from "./util/client-server-factory.js";
import { ClientBase, ServerBase } from "./util/classes.js";

export { ClientBase, ServerBase };

// There is no loose `extends` keyword, akin to `instanceof` unfortunately,
// so we have to check our class hierarchy using a while loop
function ensureClassHierarchy(ClientClass, ServerClass) {
  let X = ClientClass;
  let clientPasses = false;
  while (X.prototype) {
    if (X === ClientBase) {
      clientPasses = true;
      break;
    }
    X = X.__proto__;
  }
  if (!clientPasses) throw new Error("Client class must extend ClientBase ");

  X = ServerClass;
  let serverPasses = false;
  while (X.prototype) {
    if (X === ServerBase) {
      serverPasses = true;
      break;
    }
    X = X.__proto__;
  }
  if (!serverPasses) throw new Error("Server class must extend ServerBase");
}

/**
 * Generate a factory object for building clients and servers that know how
 * to talk to each other over websocket connections.
 *
 * @param {class} ClientClass    a class definition with namespaces functions.
 * @param {class} ServerClass    a class definition with namespaces functions.
 */
export function generateClientServer(ClientClass, ServerClass, API) {
  // Make sure the client and server implement the base classes
  ensureClassHierarchy(ClientClass, ServerClass);

  // If we're given an API object, resolve down to bare
  // functions in client/server call handling.
  const resolveWithoutNamespace = !!API;

  // generate the shared API definition if not prespecified.
  API = API ?? generateAPIfromClasses(ClientClass, ServerClass);

  // get the list of all namespaces we'll be building proxies for.
  const namespaces = Object.keys(API);

  // This is the thing we'll be building up
  const factory = new ClientServerFactory();

  // Create client/server proxies and call handlers for each namespace:
  namespaces.map((namespace) => {
    const clientAPI = API[namespace].client;
    const serverAPI = API[namespace].server;

    factory.setClientNamespace(
      namespace,
      clientAPI,
      serverAPI,
      resolveWithoutNamespace
    );

    factory.setServerNamespace(
      namespace,
      clientAPI,
      serverAPI,
      resolveWithoutNamespace
    );
  });

  factory.finalise(namespaces, ClientClass, ServerClass, API);

  // And we're done!
  return factory;
}
