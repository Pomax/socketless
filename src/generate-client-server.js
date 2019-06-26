const build = require("./build.js");

/**
 * Turn an API definition, like above, into an object with the four classes
 * required by the clients and server.
 * @param {*} API
 */
function generateClientServer(API) {
  const namespaces = Object.keys(API);

  // This is the thing we'll be building up
  const factory = {
    client: {},
    server: {}
  };

  // Craete client/server proxies and call handlers for each namespace:
  namespaces.map(namespace => {
    const clientAPI = API[namespace].client;
    const serverAPI = API[namespace].server;

    factory.client[namespace] = {
      server: build.serverProxyAtClient(namespace, serverAPI),
      handler: build.serverCallHandler(namespace, clientAPI)
    };

    factory.server[namespace] = {
      client: build.clientProxyAtServer(namespace, clientAPI),
      handler: build.clientCallHandler(namespace, serverAPI)
    };
  });

  /**
   * This function creates a server-proxy object that clients
   * can make direct calls against as if the server were a
   * locally accessible resource.
   */
  Object.defineProperty(factory.client, 'createServer', {
    enumerable: false,
    configurable: false,
    writable: false,
    value: build.createServerProxy(factory, namespaces)
  });

  /**
   * This function creates a client-proxy object that servers
   * can make direct calls against as if the client were a
   * locally accessible resource.
   */
  Object.defineProperty(factory.server, 'createClient', {
    enumerable: false,
    configurable: false,
    writable: false,
    value: build.createClientProxy(factory, namespaces)
  });

  /**
   * This function allows people to setup a web+socket server
   * without having to ever explicitly write socketio code.
   */
  factory.createServer = build.createServer(factory, namespaces);

  /**
   * This allows people to setup a socket client without
   * having to ever explicitly write socketio code.
   */
  factory.createClient = build.createClient(factory);

  // And we're done!
  return factory;
}

module.exports = { generateClientServer };
