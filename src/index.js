// @ts-ignore: Node-specific import
import http from "node:http";
// @ts-ignore: Node-specific import
import https from "node:https";

import { WebSocket, WebSocketServer } from "ws";
import { formClientClass, formServerClass } from "./classes.js";
import { formWebClientClass } from "./webclient/classes.js";
import { CustomRouter } from "./webclient/custom-router.js";
import { makeRouteHandler } from "./webclient/route-handler.js";
import { RESPONSE_SUFFIX, getResponseName, lock } from "./upgraded-socket.js";

// used to force the browser socket router to handle a response, even though
// normally browser communication has to get send on to the server.
const FORCED_ROUTE_HANDLING = true;

const DEBUG = false;

// a convenience export
export const ALLOW_SELF_SIGNED_CERTS = Symbol("allow self-signed certificates");

/**
 * Create a server instance for this client/server API.
 * @param {*} serverOrHttpsOptions either an http(s) server instance,
 *            or an https options object for Node's built-in http(s)
 *            createServer functions. Or nothing, to create a plain
 *            http server rather than an https server.
 * @returns {{ server: ServerClass, webServer: http.Server, webserver: http.Server}}
 */
export function createServer(ServerClass, serverOrHttpsOptions) {
  // rewrite the serverclass so it's hierarchically sound
  ServerClass = formServerClass(ServerClass);

  let httpServer;
  let httpsOptions;
  if (serverOrHttpsOptions?.constructor === Object) {
    httpsOptions = serverOrHttpsOptions;
  } else {
    httpServer = serverOrHttpsOptions;
  }

  // create a web server, if we don't already have one.
  let webServer = httpServer;
  if (!webServer) {
    const router = new CustomRouter(null);
    const routeHandling = (req, res) => {
      if (req.url.includes(`?`)) {
        const [url, params] = req.url.split(/\\?\?/);
        req.url = url;
        req.params = new URLSearchParams(params);
      }
      router.handle(req.url, req, res);
    };
    webServer = httpsOptions
      ? https.createServer(httpsOptions, routeHandling)
      : http.createServer(routeHandling);

    // Rebind the function that allows users to specify custom route handling:

    // @ts-ignore: we're adding a custom property to a Server instance, which TS doesn't like.
    webServer.addRoute = router.addRouteHandler.bind(router);
    // @ts-ignore: idem ditto
    webServer.removeRoute = router.removeRoute.bind(router);
  }

  // create a websocket server, so we can handle websocket upgrade calls.
  const ws = new WebSocketServer({ noServer: true });

  ws.on(`error`, (err) => server.onError(err));

  webServer.on(`upgrade`, (req, socket, head) => {
    // console.log(`http->ws upgrade call`);
    ws.handleUpgrade(req, socket, head, (websocket) => {
      // console.log(`upgraded http->ws`);
      ws.emit(`connection`, websocket, req);
    });
  });

  // create our actual RPC server object.
  const server = new ServerClass(ws, webServer);

  // And add the `lock` function to offer some security.
  Object.defineProperty(server, `lock`, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: (object, unlock = (_client) => false) => lock(object, unlock),
  });

  // call server init
  (async () => await server.init())();

  // And of course, when we receive a websocket connection, add that socket as a client.
  ws.on(`connection`, function (socket) {
    // console.log(`client.connectClientSocket`);
    server.connectClientSocket(socket);
  });

  // and then return the web server for folks to .listen() etc.
  return {
    server,
    webServer,
    // @deprecated
    webserver: webServer,
  };
}

/**
 * Create a client instance for this client/server API.
 * @param {string} serverURL
 * @param {Symbol|undefined} allow_self_signed_certs
 * @param {*} TargetClientClass optional, defaults to ClientClass
 * @returns
 */
export function createClient(
  ClientClass,
  serverURL,
  allow_self_signed_certs,
  TargetClientClass = formClientClass(ClientClass),
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

  // call init first, *then* start trying to connect.
  (async () => {
    await client.init();
    client.reconnect();
  })();

  return client;
}

/**
 * Create a web client for this client/server API.
 * @param {string} serverUrl
 * @param {string} publicDir
 * @param {*} httpsOptions
 * @param {Symbol|undefined} allow_self_signed_certs
 * @returns {{ client: WebClientClass, clientWebServer: http.Server}}
 */
export function createWebClient(
  ClientClass,
  serverUrl,
  publicDir,
  httpsOptions,
  allow_self_signed_certs,
) {
  const WebClientClass = formWebClientClass(formClientClass(ClientClass));

  const client = createClient(
    undefined,
    serverUrl,
    allow_self_signed_certs,
    WebClientClass,
  );

  const router = new CustomRouter(client);
  let routeHandling = makeRouteHandler(client, publicDir, router);
  const webServer = httpsOptions
    ? https.createServer(httpsOptions, routeHandling)
    : http.createServer(routeHandling);

  const ws = new WebSocketServer({ noServer: true });
  webServer.on(`upgrade`, (req, socket, head) => {
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
  client.webServer = webServer;

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
        let proxyResult = {
          name: responseName,
          payload: undefined,
          error: undefined,
        };

        const clientOnly = [`quit`, `disconnect`].includes(eventName);

        // ... if there is a server, of course.
        if (!clientOnly && client.server) {
          let target = client.server;
          const steps = eventName.split(`:`);
          while (steps.length) target = target[steps.shift()];
          // Proxy the result of the server call
          try {
            const result = await target(...payload);
            proxyResult.payload = result;
          } catch (e) {
            // Or proxy the result of the server call throwing an error
            proxyResult.error = e.message;
          }
        }

        // If there isn't, this is a proxy error
        else {
          proxyResult.error = `Server not available`;
        }

        // If we're dealing with a known client-only function call, or
        // we have an error, and it's an "undefined" error, see if we
        // can resolve this as a local call for the client:
        if (
          clientOnly ||
          proxyResult.error === `Server not available` ||
          (!eventName.includes(`:`) &&
            proxyResult.error &&
            proxyResult.error.includes(`function is undefined`))
        ) {
          // We only allow the browser to call instance-level client class functions:
          const target = client[eventName]?.bind(client);
          if (target && typeof target === `function`) {
            try {
              const result = await target(...payload);
              proxyResult.payload = result;
              proxyResult.error = undefined;
            } catch (e) {
              proxyResult.error = e.message;
            }
          }
        }

        socket.send(JSON.stringify(proxyResult));
      }
    });

    socket.on(`close`, () => {
      // console.log(`browser disconnected`);
      client.disconnectBrowserSocket();
    });
  });

  // Rebind the function that allows users to specify custom route handling:

  // @ts-ignore: we're adding a custom property to a Server instance, which TS doesn't like.
  webServer.addRoute = router.addRouteHandler.bind(router);
  // @ts-ignore: idem ditto
  webServer.removeRoute = router.removeRoute.bind(router);

  return { client, clientWebServer: webServer };
}

/**
 * Create a client/server factory, given the client and server classes.
 */
function generator(ClientClass, ServerClass) {
  const factory = {
    // wrapper
    createServer: function (serverOrHttpsOptions) {
      return createServer(ServerClass, serverOrHttpsOptions);
    },

    // wrapper
    createClient: function (
      serverURL,
      allow_self_signed_certs,
      TargetClientClass,
    ) {
      return createClient(
        ClientClass,
        serverURL,
        allow_self_signed_certs,
        TargetClientClass,
      );
    },

    // wrapper
    createWebClient: function (
      serverUrl,
      publicDir,
      httpsOptions,
      allow_self_signed_certs,
    ) {
      return createWebClient(
        ClientClass,
        serverUrl,
        publicDir,
        httpsOptions,
        allow_self_signed_certs,
      );
    },
  };

  return factory;
}

export { generator as linkClasses };
