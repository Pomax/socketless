// @ts-ignore: Node-specific import
import http from "http";
// @ts-ignore: Node-specific import
import https from "https";

import { WebSocket, WebSocketServer } from "ws";
import {
  formClientClass,
  formServerClass,
  formWebClientClass,
} from "./classes.js";
import { CustomRouter } from "./webclient/custom-router.js";
import { makeRouteHandler } from "./webclient/route-handler.js";
import { getResponseName } from "./upgraded-socket.js";

const DEBUG = false;

/**
 * Create a client/server factory, given the client and server classes.
 * @param {*} ClientClass
 * @param {*} ServerClass
 * @returns
 */
export function generateClientServer(ClientClass, ServerClass) {
  ClientClass = formClientClass(ClientClass);
  ServerClass = formServerClass(ServerClass);

  const WebClientClass = formWebClientClass(ClientClass);

  const factory = {
    /**
     * Create a server instance for this client/server API.
     * @param {*} serverOrHttpsOptions either an http(s) server instance,
     *            or an https options object for Node's built-in http(s)
     *            createServer functions. Or nothing, to create a plain
     *            http server rather than an https server.
     * @returns
     */
    createServer: function createServer(serverOrHttpsOptions) {
      let httpServer;
      let httpsOptions;
      if (serverOrHttpsOptions?.constructor === Object) {
        httpsOptions = serverOrHttpsOptions;
      } else {
        httpServer = serverOrHttpsOptions;
      }
      let webserver = httpServer;
      if (!webserver) {
        webserver = httpsOptions
          ? https.createServer(httpsOptions)
          : http.createServer();
      }
      const ws = new WebSocketServer({ server: webserver });
      const server = new ServerClass(ws, webserver);
      ws.on(`connection`, function (socket) {
        if (DEBUG) console.log(`client.connectClientSocket`);
        server.connectClientSocket(socket);
      });
      return webserver;
    },

    /**
     * Create a client instance for this client/server API.
     * @param {*} serverURL
     * @param {*} TargetClientClass optional, defaults to ClientClass
     * @returns
     */
    createClient: function createClient(
      serverURL,
      TargetClientClass = ClientClass,
    ) {
      const socketToServer = new WebSocket(serverURL);
      const client = new TargetClientClass();
      socketToServer.on(`close`, (...data) => client.onDisconnect(...data));
      function registerForId(data) {
        try {
          const { name, payload } = JSON.parse(data);
          if (name === `handshake:setid`) {
            if (DEBUG) console.log(`client: received handshake:setid`);
            socketToServer.off(`message`, registerForId);
            if (DEBUG) console.log(`setting state:`, payload);
            client.setState(payload);
            if (DEBUG) console.log(`calling connectServerSocket`);
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
      httpsOptions,
    ) {
      const client = factory.createClient(serverUrl, WebClientClass);

      const router = new CustomRouter(client);
      let routeHandling = makeRouteHandler(publicDir, router);
      const webserver = httpsOptions
        ? https.createServer(httpsOptions, routeHandling)
        : http.createServer(routeHandling);
      const ws = new WebSocketServer({ server: webserver });

      client.ws = ws;
      client.webserver = webserver;

      ws.on(`connection`, (socket) => {
        // bind the socket to the browser and set up message parsing
        client.connectBrowserSocket(socket);
        socket.on(`message`, async (message) => {
          message = message.toString();
          const { name: eventName, payload } = JSON.parse(message);

          // Is this a special client/browser call?
          if (eventName === `syncState`) {
            return socket.send(
              JSON.stringify({
                name: getResponseName(eventName),
                payload: await client.syncState(),
              }),
            );
          }

          // If it's not, proxy the call from the browser to the server
          let target = client.server;
          const steps = eventName.split(`:`);
          while (steps.length) target = target[steps.shift()];
          const result = await target(...payload);
          // and then proxy the response back to the browser
          socket.send(
            JSON.stringify({
              name: getResponseName(eventName),
              payload: result,
            }),
          );
        });

        socket.on(`close`, () => {
          if (DEBUG) console.log(`browser disconnected`);
          client.disconnectBrowserSocket();
        });
      });

      // Rebind the function that allows users to specify custom route handling:
      // @ts-ignore: we're adding a custom property to a Server instance, which TS doesn't like.
      webserver.addRoute = router.addRouteHandler.bind(router);
      return webserver;
    },
  };

  return factory;
}
