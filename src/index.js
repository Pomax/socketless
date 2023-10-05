import { generateAPIfromClasses } from "./util/generate-api-from-classes.js";
import { ClientServerFactory } from "./util/client-server-factory.js";

/**
 * Generate a factory object for building clients and servers that know how
 * to talk to each other over websocket connections.
 *
 * @param {class} ClientClass    a class definition with namespaces functions.
 * @param {class} ServerClass    a class definition with namespaces functions.
 */
export function generateClientServer(ClientClass, ServerClass, API = false) {
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
      resolveWithoutNamespace,
    );

    factory.setServerNamespace(
      namespace,
      clientAPI,
      serverAPI,
      resolveWithoutNamespace,
    );
  });

  factory.finalise(namespaces, ClientClass, ServerClass, API);

  // And we're done!
  return factory;
}
