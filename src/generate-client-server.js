const build = require("./build.js");

function attach(object, fname, value) {
  Object.defineProperty(object, fname, {
    enumerable: false,
    configurable: false,
    writable: false,
    value: value
  });
}

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
  attach(factory.client, 'createServer', build.createServerProxy(factory, namespaces));

  /**
   * This function creates a client-proxy object that servers
   * can make direct calls against as if the client were a
   * locally accessible resource.
   */
  attach(factory.server, 'createClient', build.createClientProxy(factory, namespaces));

  /**
   * This function allows people to setup a web+socket server
   * without having to ever explicitly write socketio code.
   */
  attach(factory, 'createServer', build.createServer(factory, namespaces));

  /**
   * This allows people to setup a socket client without
   * having to ever explicitly write socketio code.
   */
  attach(factory, 'createClient', build.createClient(factory));

  // And we're done!
  return factory;
}

module.exports = { generateClientServer };
