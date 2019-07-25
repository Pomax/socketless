const build = require("./build.js");

// helper function to make defineProperty easier to use.
function attach(object, fname, value) {
  Object.defineProperty(object, fname, {
    enumerable: false,
    configurable: false,
    writable: false,
    value: value
  });
}

// helper function to find all declared class functions
// all the way up to the Object chain.
function getAllFunctions(objectClass) {
  const functions = [];
  while (objectClass.prototype) {
    const proto = objectClass.prototype;
    const verify = v =>
      typeof proto[v] === "function" && v.match(/[$:]/) !== null;
    Object.getOwnPropertyNames(proto).filter(verify).forEach(name => {
      if (functions.indexOf(name) === -1) functions.push(name);
    });
    objectClass = objectClass.__proto__;
  }
  return functions;
}

// helper function to record function names for namespaces
function register(API, type, name) {
  const [namespace, fname] = name.split(/[$:]/);
  if (!API[namespace]) API[namespace] = { client: [], server: [] };
  API[namespace][type].push(fname);
}

/**
 * API abstraction function that takes the two classes,
 * and turns it into a namespaced API object.
 */
function generateAPIfromClasses(ClientClass, ServerClass, API = {}) {
  getAllFunctions(ClientClass).forEach(name => register(API, "client", name));
  getAllFunctions(ServerClass).forEach(name => register(API, "server", name));
  return API;
}

/**
 * Generate a factory object for building clients and servers that know how
 * to talk to each other over websocket connections.
 *
 * @param {class} ClientClass    a class definition with namespaces functions.
 * @param {class} ServerClass    a class definition with namespaces functions.
 */
function generateClientServer(ClientClass, ServerClass, API = false) {
  // If we're given an API object, resolve down to bare
  // functions in client/server call handling.
  const resolveWithoutNamespace = !!API;

  // generate the shared API definition if not prespecified.
  API = API || generateAPIfromClasses(ClientClass, ServerClass);

  // get the list of all namespaces we'll be building proxies for.
  const namespaces = Object.keys(API);

  // This is the thing we'll be building up
  const factory = {
    client: {},
    server: {}
  };

  // Create client/server proxies and call handlers for each namespace:
  namespaces.map(namespace => {
    const clientAPI = API[namespace].client;
    const serverAPI = API[namespace].server;

    factory.client[namespace] = {
      server: build.serverProxyAtClient(namespace, serverAPI),
      handler: build.serverCallHandler(
        namespace,
        clientAPI,
        resolveWithoutNamespace
      )
    };

    factory.server[namespace] = {
      client: build.clientProxyAtServer(namespace, clientAPI),
      handler: build.clientCallHandler(
        namespace,
        serverAPI,
        resolveWithoutNamespace
      )
    };
  });

  /**
   * This function creates a server-proxy object that clients
   * can make direct calls against as if the server were a
   * locally accessible resource.
   */
  attach(
    factory.client,
    "createServer",
    build.createServerProxy(factory, namespaces)
  );

  /**
   * This function creates a client-proxy object that servers
   * can make direct calls against as if the client were a
   * locally accessible resource.
   */
  attach(
    factory.server,
    "createClient",
    build.createClientProxy(factory, namespaces)
  );

  /**
   * This function allows people to setup a web+socket server
   * without having to ever explicitly write socketio code.
   */
  attach(
    factory,
    "createServer",
    build.createServer(factory, namespaces, ServerClass, API)
  );

  /**
   * This allows people to setup a socket client without
   * having to ever explicitly write socketio code.
   */
  attach(factory, "createClient", build.createClient(factory, ClientClass));

  /**
   * This function allows people to socket client that runs
   * its own web+socket server for attaching a browser to,
   * without having to ever explicitly write socketio code.
   */
  attach(
    factory,
    "createWebClient",
    build.createWebClient(factory, ClientClass, API)
  );

  // And we're done!
  return factory;
}

module.exports = { generateClientServer };
