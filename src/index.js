// @ts-ignore: Node-specific import
import http from "node:http";
// @ts-ignore: Node-specific import
import https from "node:https";

import { WebSocket, WebSocketServer } from "ws";
import { formClientClass, formServerClass } from "./classes.js";
import { formWebClientClass } from "./webclient/classes.js";
import { CustomRouter } from "./webclient/custom-router.js";
import { makeRouteHandler } from "./webclient/route-handler.js";
import { RESPONSE_SUFFIX, getResponseName } from "./upgraded-socket.js";

// used to force the browser socket router to handle a response, even though
// normally browser communication has to get send on to the server.
const FORCED_ROUTE_HANDLING = true;

// a convenience export
export const ALLOW_SELF_SIGNED_CERTS = Symbol("allow self-signed certificates");

/**
 * Create a client/server factory, given the client and server classes.
 * @param {*} ClientClass
 * @param {*} ServerClass
 * @returns
 */
function generator(ClientClass, ServerClass) {
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

      // create a web server, if we don't already have one.
      let webserver = httpServer;
      if (!webserver) {
        const router = new CustomRouter(null);
        const routeHandling = (req, res) => {
          if (req.url.includes(`?`)) {
            const [url, params] = req.url.split(/\\?\?/);
            req.url = url;
            req.params = new URLSearchParams(params);
          }
          router.handle(req.url, req, res);
        };
        webserver = httpsOptions
          ? https.createServer(httpsOptions, routeHandling)
          : http.createServer(routeHandling);

        // Rebind the function that allows users to specify custom route handling:

        // @ts-ignore: we're adding a custom property to a Server instance, which TS doesn't like.
        webserver.addRoute = router.addRouteHandler.bind(router);
        // @ts-ignore: idem ditto
        webserver.removeRoute = router.removeRoute.bind(router);
      }

      // create a websocket server, so we can handle websocket upgrade calls.
      const ws = new WebSocketServer({ noServer: true });
      webserver.on(`upgrade`, (req, socket, head) => {
        // console.log(`http->ws upgrade call`);
        ws.handleUpgrade(req, socket, head, (websocket) => {
          // console.log(`upgraded http->ws`);
          ws.emit(`connection`, websocket, req);
        });
      });

      // create our actual RPC server object.
      const server = new ServerClass(ws, webserver);

      // And of course, when we receive a websocket connection, add that socket as a client.
      ws.on(`connection`, function (socket) {
        // console.log(`client.connectClientSocket`);
        server.connectClientSocket(socket);
      });

      // and then return the web server for folks to .listen() etc.
      return webserver;
    },

    /**
     * Create a client instance for this client/server API.
     * @param {string} serverURL
     * @param {Symbol|undefined} allow_self_signed_certs
     * @param {*} TargetClientClass optional, defaults to ClientClass
     * @returns
     */
    createClient: function createClient(
      serverURL,
      allow_self_signed_certs,
      TargetClientClass = ClientClass,
    ) {
      serverURL = serverURL.replace(`http`, `ws`);
      const socketToServer = new WebSocket(serverURL, {
        rejectUnauthorized: allow_self_signed_certs !== ALLOW_SELF_SIGNED_CERTS,
      });
      const client = new TargetClientClass();
      socketToServer.on(`close`, (...data) => client.onDisconnect(...data));
      function registerForId(data) {
        try {
          const { name, payload } = JSON.parse(data);
          if (name === `handshake:setid`) {
            // console.log(`client: received handshake:setid`);
            socketToServer.off(`message`, registerForId);
            // console.log(`setting state:`, payload);
            client.setState(payload);
            // console.log(`calling connectServerSocket`);
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
     * @param {string} serverUrl
     * @param {string} publicDir
     * @param {*} httpsOptions
     * @param {Symbol|undefined} allow_self_signed_certs
     * @returns {{ client: WebClientClass, clientWebServer: http.Server}}
     */
    createWebClient: function createWebClient(
      serverUrl,
      publicDir,
      httpsOptions,
      allow_self_signed_certs,
    ) {
      const client = factory.createClient(
        serverUrl,
        allow_self_signed_certs,
        WebClientClass,
      );

      const router = new CustomRouter(client);
      let routeHandling = makeRouteHandler(publicDir, router);
      const webserver = httpsOptions
        ? https.createServer(httpsOptions, routeHandling)
        : http.createServer(routeHandling);

      const ws = new WebSocketServer({ noServer: true });
      webserver.on(`upgrade`, (req, socket, head) => {
        // console.log(`http->ws upgrade call`);
        ws.handleUpgrade(req, socket, head, (websocket) => {
          // console.log(`upgraded http->ws`);
          ws.emit(`connection`, websocket, req);
        });
      });

      client.ws = ws;
      client.webserver = webserver;

      ws.on(`connection`, (socket) => {
        // bind the socket to the browser and set up message parsing
        client.connectBrowserSocket(socket);
        socket.on(`message`, async (message) => {
          message = message.toString();
          const { name: eventName, payload, error } = JSON.parse(message);

          if (error) {
            throw new Error(error);
          }

          // Is this a special client/browser call?
          const responseName = getResponseName(eventName);

          if (eventName === `syncState`) {
            const fullState = await client.syncState();
            // console.log(`Webclient received syncState from browser, sending [${responseName}]`);
            return socket.send(
              JSON.stringify({
                name: responseName,
                payload: fullState,
              }),
            );
          }

          if (eventName === `quit`) {
            return client.quit();
          }

          if (eventName === `disconnect`) {
            return client.disconnect();
          }

          // Is this a browser response to the client' calling a browser function?
          if (eventName.endsWith(RESPONSE_SUFFIX)) {
            // Note that because this doesn't use the upgraded socket's "send()"
            // mechanism, there is no timeout on browser responses. Which is good,
            // because humans like to take their time on things.
            client.browser.socket.router(message, FORCED_ROUTE_HANDLING);
          }

          // If it's not, proxy the call from the browser to the server
          else {
            let target = client.server;
            const steps = eventName.split(`:`);
            while (steps.length) target = target[steps.shift()];
            const result = await target(...payload);
            // and then proxy the response back to the browser
            socket.send(
              JSON.stringify({
                name: responseName,
                payload: result,
              }),
            );
          }
        });

        socket.on(`close`, () => {
          // console.log(`browser disconnected`);
          client.disconnectBrowserSocket();
        });
      });

      // Rebind the function that allows users to specify custom route handling:

      // @ts-ignore: we're adding a custom property to a Server instance, which TS doesn't like.
      webserver.addRoute = router.addRouteHandler.bind(router);
      // @ts-ignore: idem ditto
      webserver.removeRoute = router.removeRoute.bind(router);
      return { client, clientWebServer: webserver };
    },
  };

  return factory;
}

export { generator as linkClasses };
