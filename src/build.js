module.exports = {
  // generators for call routing at the client and server.
  clientCallHandler: require("./server/client-call-handler.js"),
  serverCallHandler: require("./client/server-call-handler.js"),

  // generators for the proxy represenations of the client at the
  // server, and the server at the client.
  clientProxyAtServer: require("./server/client-proxy-at-server.js"),
  serverProxyAtClient: require("./client/server-proxy-at-client.js"),

  // factory functions for the client and server proxies.
  createClientProxy: require("./server/create-client-proxy.js"),
  createServerProxy: require("./client/create-server-proxy.js"),

  // factory functions for the actual socket.io client/server.
  createClient: require('./client/create-client.js'),
  createWebClient: require('./webclient/create-web-client.js'),
  createServer: require('./server/create-server.js')
};
