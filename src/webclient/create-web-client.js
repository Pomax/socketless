const fs = require(`fs`);
const path = require(`path`);
const upgradeSocket = require("../upgrade-socket.js");
const generateProxyClientServer = require("./generate-proxy-client-server.js");
const getState = require("./get-state.js");

module.exports = function(factory, namespaces, ClientClass, ServerClass, API) {
  // create a "bundle" consisting of:
  // - node_modules/socket.io-client/dist/socket.io.dev.js
  // - src/upgrade-socket.js
  // - custom code that sets up window.createServer() that yields an object that
  //   connects to this web server, with the same API as the "real" server.
  let socketlessjs = [
    `const ClientServer = { generateClientServer: function(WebClientClass) {`,
    `const exports = {};`,
    fs
      .readFileSync(
        path.join(
          __dirname,
          `../../node_modules/socket.io-client/dist/socket.io.dev.js`
        )
      )
      .toString("utf-8"),
    fs
      .readFileSync(path.join(__dirname, `../upgrade-socket.js`))
      .toString("utf-8")
      .replace(`module.exports = upgradeSocket;`, ``),
    `
    const namespaces = ${JSON.stringify(namespaces)};
    const API = ${JSON.stringify(API)};
    return ${generateProxyClientServer.toString()}(WebClientClass);
    `,
    `}}`
  ].join(`\n`);

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

    Object.getOwnPropertyNames(ClientClass.prototype).forEach(name => {
      WebClientClass.prototype[name] = async function(data) {
        let evt = name.replace("$", ":");
        // first call the "real" client code
        let response = await ClientClass.prototype[name].bind(this)(data);
        // then pass-through to the browser
        if (sockets.browser) response = await sockets.browser.emit(evt, data);
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
    const routes = require("./routes.js")(rootDir, publicDir, socketlessjs);
    const webserver = require(https ? "https" : "http").createServer(routes);
    const io = require("socket.io")(webserver);

    // Allow for socket binding and setting up call handling
    const setBrowser = function(socket) {
      let client = sockets.client;
      let server = client.server;

      // record connection from browser and send a bootstrap instruction.
      browser = sockets.browser = upgradeSocket(socket);
      client.browser_connected = true;

      const bypassTheseProperties = [
        "is_web_client",
        "browser_connected",
        "server"
      ];

      socket.emit(
        `bootstrap:self`,
        getState(sockets.client, bypassTheseProperties)
      );

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

    // Set up connect/disconnect handling for browser
    io.on(`connection`, setBrowser);
    io.on(
      `disconnect`,
      () => (sockets.client.browser_connected = sockets.browser = false)
    );

    return webserver;
  };
};
