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

const DEBUG = false;

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
     * @returns {{ server: ServerClass, webserver: http.Server }}
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

      ws.on(`error`, (err) => server.onError(err));

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
      return { server, webserver };
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

      const client = new TargetClientClass();

      // Are there URL parameters we need to collect?
      let params = { get: (_) => undefined };
      if (serverURL.includes(`?`)) {
        params = new URLSearchParams(serverURL.split(`?`)[1]);
      }

      Object.defineProperty(client, `params`, {
        value: params,
        writable: false,
        configurable: false,
        enumerable: false,
      });

      Object.defineProperty(client, `reconnect`, {
        value: () => {
          if (client.server) return;

          let socketToServer;
          try {
            socketToServer = new WebSocket(serverURL, {
              rejectUnauthorized:
                allow_self_signed_certs !== ALLOW_SELF_SIGNED_CERTS,
            });
          } catch (e) {
            // Deal with a bug in ws's implementation of WebSocket, where
            // it will throw an "invalid URL" error even though the actual
            // problem is that the URL isn't accessible. The URL is valid,
            // it just can't resolve. That's not an error. That's the internet.
            if (e instanceof SyntaxError && e.message.includes(`Invalid URL`)) {
              return;
            }
            throw e;
          }

          function registerForId(data) {
            try {
              const { name, payload } = JSON.parse(data);
              if (name === `handshake:setid`) {
                socketToServer.off(`message`, registerForId);
                client.setState(payload);
                client.connectServerSocket(socketToServer);
              }
            } catch (e) {
              // ignore
            }
          }

          socketToServer.on(`error`, (err) => client.onError(err));
          socketToServer.on(`close`, (...data) => {
            const propagate = !!client.server;
            client.server = undefined;
            if (propagate) client.onDisconnect(...data);
          });
          socketToServer.on(`message`, registerForId);
        },
        writable: false,
        configurable: false,
        enumerable: false,
      });

      client.reconnect();

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
      let routeHandling = makeRouteHandler(client, publicDir, router);
      const webserver = httpsOptions
        ? https.createServer(httpsOptions, routeHandling)
        : http.createServer(routeHandling);

      const ws = new WebSocketServer({ noServer: true });
      webserver.on(`upgrade`, (req, socket, head) => {
        const url = req.url;
        let params = {
          get: (_) => undefined,
        };

        if (url.includes(`?`)) {
          params = new URLSearchParams(url.split(`?`)[1]);
        }

        const sid = client.params.get(`sid`);
        if (sid && params.get(`sid`) !== sid) {
          if (DEBUG)
            console.error(`incorrect SID provided during ws upgrade request`);
          return socket.end();
        }

        ws.handleUpgrade(req, socket, head, (websocket) => {
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

          // Is this a browser response to the client' calling a browser function?
          if (eventName.endsWith(RESPONSE_SUFFIX)) {
            // Note that because this doesn't use the upgraded socket's "send()"
            // mechanism, there is no timeout on browser responses. Which is good,
            // because humans like to take their time on things.
            client.browser.socket.router(message, FORCED_ROUTE_HANDLING);
          }

          // If it's not, proxy the call from the browser to the server
          else {
            if (client.server) {
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
            } else {
              socket.send(
                JSON.stringify({
                  name: responseName,
                  payload: undefined,
                  error: `Server not available`,
                }),
              );
            }
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
