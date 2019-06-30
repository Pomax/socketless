const upgradeSocket = require("../upgrade-socket.js");
const generateSocketless = require("./generate-socketless.js");
const getState = require("./utils/get-state.js");
const getStateDiff = require("./utils/get-state-diff.js");

module.exports = function createWebClient(
  factory,
  namespaces,
  ClientClass,
  API
) {
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
    const routes = require("./utils/routes.js")(
      rootDir,
      publicDir,
      generateSocketless(API)
    );
    const webserver = require(https ? "https" : "http").createServer(routes);
    const io = require("socket.io")(webserver);

    // Allow for socket binding and setting up call handling
    function connectBrowser(socket) {
      let client = sockets.client;
      let server = client.server;

      // record connection from browser and send a bootstrap instruction.
      browser = sockets.browser = upgradeSocket(socket);
      client.browser_connected = true;

      // set up the sync functionality

      const bypassTheseProperties = [
        "is_web_client",
        "browser_connected",
        "server"
      ];

      // Our state update is based on state diffs, because sending
      // a full state every time is quite silly.
      let prevState = {};

      const getStateUpdate = () => {
        const state = getState(sockets.client, bypassTheseProperties)
        const stateDiff = getStateDiff(state, prevState)
        prevState = state;
        return stateDiff;
      }

      // sync request from browser to client
      socket.on(`sync`, (_data, respond) => respond(getStateUpdate()));

      // sync data from client to browser:
      // and of course, send an initial sync
      socket.emit(`sync`, getStateUpdate());

      // Set up proxy functions for routing browser => server
      namespaces.forEach(namespace => {
        API[namespace].server.forEach(fname => {
          socket.on(`${namespace}:${fname}`, async (data, respond) => {
            respond(await server[namespace][fname](data));
          });
        });
      });

      // Add a quit() handler so the browser can "kill" the client:
      socket.on("quit", () => server.disconnect());
    };

    io.on(`connection`, connectBrowser);

    io.on(`disconnect`, () => {
      sockets.client.browser_connected = sockets.browser = false;
    });

    return webserver;
  };
};
