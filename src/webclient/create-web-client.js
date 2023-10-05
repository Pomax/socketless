import { WebSocketServer } from "ws";
import { attach } from "../util/attach.js";
import { generateSocketless } from "./generate-socketless.js";
import { makeRouteHandler } from "./utils/routes.js";
import { CustomRouter } from "./utils/custom-router.js";
import { setupConnectionHandler } from "./setup-connection-handler.js";
// @ts-ignore: Node-specific import
import url from "url";
// @ts-ignore: Node-specific import
import http from "http";
// @ts-ignore: Node-specific import
import https from "https";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

export function createWebClient(factory, ClientClass, API) {
  // Prep: derive all client functions that we may need to proxy
  const APInames = Object.keys(API).flatMap((namespace) =>
    API[namespace].client.map((fname) => `${namespace}:${fname}`),
  );

  /**
   * This function creates a websocket client with all the bells and
   * whistles taken care of so the user doesn't ever need to write
   * any socket code explicitly, with built-in server capabilities
   * so that it can act as proxy between the server, and a browser.
   */
  return function (serverURL, publicDir, options = {}) {
    let queryParameters = {};

    if (serverURL.includes(`?`)) {
      const query = new URLSearchParams(serverURL.split(/\\?\?/)[1]);
      const entries = Array.from(query.keys()).map((k) => {
        const items = query.getAll(k);
        return [k, items.length > 1 ? items : items[0]];
      });
      queryParameters = Object.fromEntries(entries);
    }

    const { httpsOptions, directSync, middleware } = options;

    const rootDir = `${__dirname}/../`;

    // socket from this client to the server
    const sockets = { client: undefined, browser: undefined };

    // Proxy class
    class WebClientClass extends ClientClass {
      constructor(...args) {
        super(queryParameters, ...args);
      }
    }

    // Proxy calls by first having the ClientClass deal with them,
    // and then forwarding them on to the browser.
    Object.getOwnPropertyNames(ClientClass.prototype).forEach((name) => {
      const evtName = name.replace("$", ":");

      // Skip over any name not mentioned in the earlier-abstracted API,
      // noting that the namespace separator is `:`, even if the code itself
      // uses the `$` separator in any functors.
      if (APInames.indexOf(evtName) === -1) return;

      // TODO: document the fact that this means we MUST use namespacing
      //       for webclients, because otherwise proxying won't work.

      WebClientClass.prototype[name] = async function (data) {
        let response = await ClientClass.prototype[name].bind(this)(data);
        if (sockets.browser) {
          // always send a state diff to ensure client and browser have the same state.
          sockets.browser.sync();
          // capture and use the browser's response, if it implements this call handler.
          response =
            (await sockets.browser.upgraded.send(evtName, data)) || response;
        }
        return response;
      };

      // We need to bind the function's name so that we can resolve
      // it during broadcasts, which look for the function.name property,
      // which is undefined in the above anonymous function binding.
      WebClientClass.prototype[name].customname = name;
    });

    // bind a client socket to the server
    const client = (sockets.client = factory.createClient(
      serverURL,
      WebClientClass,
    ));

    // and set an immutable flag that marks this as a web client
    attach(client, "is_web_client", true);

    // then bind the client URL parameters?
    attach(client, "params", queryParameters);

    // Set up the web+socket server for browser connections
    const router = new CustomRouter(client);
    let routeHandling = makeRouteHandler(
      rootDir,
      publicDir,
      generateSocketless(API, directSync),
      router,
    );

    if (middleware) {
      const handle = routeHandling;
      routeHandling = async (req, res) => {
        for (let fn of middleware) {
          const result = fn(req, res);
          if (
            typeof result !== `undefined` &&
            typeof result.then === `function`
          ) {
            await result;
          }
          if (res.finished) return;
        }
        handle(req, res);
      };
    }

    const webserver = httpsOptions
      ? https.createServer(httpsOptions, routeHandling)
      : http.createServer(routeHandling);
    const ws = new WebSocketServer({ server: webserver });
    const connectBrowser = setupConnectionHandler(sockets, API, directSync);

    ws.on(`connection`, connectBrowser);
    ws.on(`close`, () => {
      client.browser_connected = sockets.browser = false;
      if (client.onBrowserDisconnect) {
        client.onBrowserDisconnect();
      }
    });

    // Rebind the function that allows users to specify custom route handling:
    // @ts-ignore: we're adding a custom property to a Server instance, which TS doesn't like
    webserver.addRoute = router.addRouteHandler.bind(router);

    return webserver;
  };
}
