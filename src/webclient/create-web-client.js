const generateSocketless = require("./generate-socketless.js");
const makeRoutes = require("./utils/routes.js");
const setupConnectionHandler = require("./setup-connection-handler.js");
const WebSocket = require("ws");

module.exports = function createWebClient(factory, ClientClass, API) {

  // Prep: derive all client functions that we may need to proxy
  const APInames = Object.keys(API).flatMap(namespace =>
    API[namespace].client.map(fname =>
      `${namespace}:${fname}`
    )
  );

  /**
   * This function creates a websocket client with all the bells and
   * whistles taken care of so the user doesn't ever need to write
   * any socket code explicitly, with built-in server capabilities
   * so that it can act as proxy between the server, and a browser.
   */
  return function(serverURL, publicDir, options = {}) {
    const { useHttps, directSync } = options;

    const rootDir = `${__dirname}/../`;

    // socket from this client to the server
    const sockets = { client: false, browser: false };

    // Proxy class
    class WebClientClass extends ClientClass {
      constructor(...args) {
        super(...args);
      }
    }

    // Proxy calls by first having the ClientClass deal with them,
    // and then forwarding them on to the browser.
    Object.getOwnPropertyNames(ClientClass.prototype).forEach(name => {
      const evtName = name.replace("$", ":");

      // Skip over any name not mentioned in the earlier-abstracted API
      if (APInames.indexOf(name) === -1) return;

      // TODO: document the fact that this means we MUST use namespacing
      //       for webclients, because otherwise proxying won't work.

      WebClientClass.prototype[name] = async function(data) {
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
    sockets.client = factory.createClient(serverURL, WebClientClass);

    // and set an immutable flag that marks this as a web client
    Object.defineProperty(sockets.client, "is_web_client", {
      configurable: false,
      writable: false,
      value: true
    });

    // Set up the web+socket server for browser connections
    const routes = makeRoutes(rootDir, publicDir, generateSocketless(API, directSync));
    const webserver = require(useHttps ? "https" : "http").createServer(routes);
    const ws = new WebSocket.Server({ server: webserver });
    const connectBrowser = setupConnectionHandler(sockets, API, directSync);

    ws.on(`connection`, connectBrowser);
    ws.on(`close`, () => {
      sockets.client.browser_connected = sockets.browser = false;
    });

    return webserver;
  };
};
