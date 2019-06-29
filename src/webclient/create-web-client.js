const fs = require(`fs`);
const path = require(`path`);

const objectToString = require("./obj-to-str.js");
const getContentType = require("./get-content-type.js");
const sanitizeLocation = require("./sanitize-location.js");
const generate404 = require("./404.js");
const nodeToESM = require("./node-to-esm.js");
const upgradeSocket = require("../upgrade-socket.js");

module.exports = function(factory, namespaces, ClientClass, ServerClass, API) {

  // create a "bundle" consisting of:
  // - node_modules/socket.io-client/dist/socket.io.dev.js
  // - src/upgrade-socket.js
  // - custom code that sets up window.createServer() that yields an object that
  //   connects to this web server, with the same API as the "real" server.
  let socketlessjs = [
    `const ClientServer = { createServer: function() {`,
    `const exports = {};`,
    fs.readFileSync(path.join(__dirname, `..`, `..`, `node_modules`,`socket.io-client`,`dist`,`socket.io.dev.js`)).toString('utf-8'),
    fs.readFileSync(path.join(__dirname, `..`, `upgrade-socket.js`)).toString('utf-8').replace(`module.exports = upgradeSocket;`, ``),
    `
    const socket = upgradeSocket(exports.io(window.location.toString()));
    const namespaces = ${JSON.stringify(namespaces)};
    const API = ${JSON.stringify(API)};
    const proxyServer = {};

    namespaces.forEach(namespace => {
      proxyServer[namespace] = {};
      API[namespace].server.forEach(fname => {
        proxyServer[namespace][fname] = async function(data) {
          return await socket.emit(namespace + ":" + fname, data);
        };
      });
    });

    proxyServer.quit = () => socket.emit('quit', {});

    return proxyServer;`,
    `}}`
  ].join(`\n`);

  /**
   * This function creates a socket.io server with all the bells and
   * whistles taken care of so the user doesn't ever need to write
   * any socket.io code explicitly.
   */
  return function(serverURL, publicDir, https = false) {
    const rootDir = `${__dirname}/../`;

    class CustomClientClass extends ClientClass {
      constructor(...args) { super(...args); }
    };

    Object.getOwnPropertyNames(ClientClass.prototype).forEach(function(name) {
      CustomClientClass.prototype[name] = async function(...args) {
        // pass-through: we can't use `super` in prototype-land.
        return ClientClass.prototype[name].bind(this)(...args);
      };
    });

    client = factory.createClient(serverURL, CustomClientClass);

    // set an immutable flag that marks this as a web client
    Object.defineProperty(client, "is_web_client", {
      configurable: false,
      writable: false,
      value: true
    });

    // Create a route handler for our local web server
    const routes = (request, response) => {
      const url = request.url;

      // special handling for socketless.js
      if (url === '/socketless.js') {
        response.writeHead(200, { "Content-Type": getContentType(".js") });
        response.end(socketlessjs, `utf-8`);
        return;
      }

      var location = sanitizeLocation(request.url, rootDir, publicDir);

      console.log(`WEBSERVER> GET ${location}`);
      fs.readFile(location, (error, content) => {
        if (error) return generate404(location, response);
        content = nodeToESM(location, content);
        response.writeHead(200, { "Content-Type": getContentType(location) });
        response.end(content, `utf-8`);
      });
    };

    // Set up the web+socket server for browser connections
    const webserver = require(https ? "https" : "http").createServer(routes);
    const io = require("socket.io")(webserver);

    // Create a local reference to the browser's socket connection:
    let browser = false;

    // Allow for socket binding and setting up call handling
    const setBrowser = socket => {
      if (browser) return;
      browser = upgradeSocket(socket);
      socket.on("quit", () => {
        console.log(`PROXY QUIT`);
        client.server.disconnect();
      });

      // Proxy functions for routing browser => server
      // (very similar to the proxyServer code above)
      namespaces.forEach(namespace => {
        API[namespace].server.forEach(fname => {
          socket.on(`${namespace}:${fname}`, async(data, respond) => {
            let result = await client.server[namespace][fname](data);
            respond(result);
          });
        });
      });

      // Proxy functions for routing server => browser
      // TODO: continue
    };

    // Set up connect/disconnect handling for browser
    io.on(`connection`, socket => setBrowser(socket));
    io.on(`disconnect`, () => (browser = false));

    return webserver;
  };
};
