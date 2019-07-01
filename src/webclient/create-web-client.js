const generateSocketless = require("./generate-socketless.js");
const makeRoutes = require("./utils/routes.js");
const setupConnectionHandler = require("./setup-connection-handler.js");

module.exports = function createWebClient(factory, ClientClass, API) {
  /**
   * This function creates a socket.io server with all the bells and
   * whistles taken care of so the user doesn't ever need to write
   * any socket.io code explicitly.
   */
  return function(serverURL, publicDir, https = false) {
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
      WebClientClass.prototype[name] = async function(data) {
        let evt = name.replace("$", ":");
        let response = await ClientClass.prototype[name].bind(this)(data);
        if (sockets.browser)
          response = response || (await sockets.browser.emit(evt, data));
        return response;
      };
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
    const routes = makeRoutes(rootDir, publicDir, generateSocketless(API));
    const webserver = require(https ? "https" : "http").createServer(routes);
    const io = require("socket.io")(webserver);
    const connectBrowser = setupConnectionHandler(sockets, API);

    io.on(`connection`, connectBrowser);
    io.on(`disconnect`, () => {
      sockets.client.browser_connected = sockets.browser = false;
    });

    return webserver;
  };
};
