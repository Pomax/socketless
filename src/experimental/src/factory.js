// @ts-ignore: Node-specific import
import http from "http";
// @ts-ignore: Node-specific import
import https from "https";

import { WebSocket, WebSocketServer } from "ws";
import { ClientBase, ServerBase } from "./classes.js";
import { CustomRouter } from "./webclient/custom-router.js";
import { makeRouteHandler } from "./webclient/routes.js";

import { log } from "./logger.js";

// Check the class hierarchy: if Base is in there, we're done. If
// it's not, we rewrite the hierarchy so that it's in there.
function ensureBaseExtension(Class, Base) {
  let prototype = Class.prototype;
  while (prototype.__proto__) {
    const cname = prototype.__proto__.constructor.name;
    if (cname === Base.name) return;
    if (cname === `Object`) break;
    prototype = prototype.__proto__;
  }
  Object.setPrototypeOf(prototype, Base.prototype);
}

// Ensure that both the client and server classes extend our base classes.
function ensureBaseExtensions(ClientClass, ServerClass) {
  ensureBaseExtension(ClientClass, ClientBase);
  ensureBaseExtension(ServerClass, ServerBase);
}

/**
 * Create a client/server factory, given the client and server classes.
 * @param {*} ClientClass
 * @param {*} ServerClass
 * @returns
 */
export function generateClientServer(ClientClass, ServerClass) {
  ensureBaseExtensions(ClientClass, ServerClass);

  function instantiateServer(ws, webserver, TargetClass = ServerClass) {
    const instance = new TargetClass();
    // We assign these outside of the constructor, because of
    // the potential class hierarchy rewrite, above.
    instance.ws = ws;
    instance.webserver = webserver;
    instance.clients = [];
    return instance;
  }

  function instantiateClient(TargetClass = ClientClass) {
    const instance = new TargetClass();
    // We assign these outside of the constructor, because of
    // the potential class hierarchy rewrite, above.
    instance.state = {};
    return instance;
  }

  const factory = {
    /**
     * Create a server instance for this client/server API.
     * @param {*} httpsOptions
     * @returns
     */
    createServer: function createServer(httpsOptions = false) {
      const webserver = httpsOptions
        ? https.createServer(httpsOptions)
        : http.createServer();
      const ws = new WebSocketServer({ server: webserver });
      const server = instantiateServer(ws, webserver);
      ws.on(`connection`, function (socket) {
        log(`client.connectClientSocket`);
        server.connectClientSocket(socket);
      });
      return webserver;
    },

    /**
     * Create a client instance for this client/server API.
     * @param {*} serverURL
     * @returns
     */
    createClient: function createClient(serverURL) {
      const socketToServer = new WebSocket(serverURL);
      const client = instantiateClient(ClientClass);
      socketToServer.on(`close`, (...data) => client.onDisconnect(...data));
      function registerForId(data) {
        try {
          const { name, payload } = JSON.parse(data);
          if (name === `handshake:setid`) {
            console.log(`client: received handshake:setid`);
            socketToServer.off(`message`, registerForId);
            console.log(`setting state:`, payload);
            client.setState(payload);
            console.log(`calling connectServerSocket`);
            client.connectServerSocket(socketToServer);
          }
        } catch (e) {
          // ignore
        }
      }
      socketToServer.on(`message`, registerForId);
      return client;
    },

    /**
     * Create a web client for this client/server API.
     * @param {*} serverUrl
     * @param {*} publicDir
     * @param {*} httpsOptions
     * @returns
     */
    createWebClient: function createWebClient(
      serverUrl,
      publicDir,
      httpsOptions
    ) {
      const client = factory.createClient(serverUrl);

      // the client connects to the real server,
      // and the browser connects to the web
      // server that wraps the client, turning
      // the client into a gateway between the
      // real server, and the browser.

      const router = new CustomRouter(client);
      let routeHandling = makeRouteHandler(publicDir, router);

      const webserver = httpsOptions
        ? https.createServer(httpsOptions, routeHandling)
        : http.createServer(routeHandling);
      const ws = new WebSocketServer({ server: webserver });

      ws.on(`connection`, (socket) => {
        // bind the socket to the browser
        client.connectBrowserSocket(socket);
        // Set up browser-to-server (and response) data proxying
        socket.on(`message`, async (message) => {
          message = message.toString();
          const { name: eventName, payload } = JSON.parse(message);
          // is this one of the special client/browser calls?
          if ([`syncState`, `quit`].includes(eventName)) {
            return socket.send(
              JSON.stringify({
                name: `${eventName}:response`,
                payload: client[eventName](),
              })
            );
          }
          // If it's none of these, proxy the call from the browser to the server
          let target = client.server;
          const steps = eventName.split(`:`);
          while (steps.length) target = target[steps.shift()];
          const result = await target(...payload);
          // and then proxy the response back to the browser
          socket.send(
            JSON.stringify({
              name: `${eventName}:response`,
              payload: result,
            })
          );
        });
      });

      ws.on(`close`, () => client.disconnectBrowserSocket());

      // Rebind the function that allows users to specify custom route handling:
      // @ts-ignore: we're adding a custom property to a Server instance, which TS doesn't like
      webserver.addRoute = router.addRouteHandler.bind(router);
      return webserver;
    },
  };

  return factory;
}
