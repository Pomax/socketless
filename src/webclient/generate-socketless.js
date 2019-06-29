const fs = require(`fs`);
const path = require(`path`);
const generateProxyClientServer = require("./generate-proxy-client-server.js");

/**
 * create a "bundle" consisting of:
 *
 * - node_modules/socket.io-client/dist/socket.io.dev.js
 * - src/upgrade-socket.js
 * - custom code that sets up window.createServer() that yields an object that
 *   connects to this web server, with the same API as the "real" server.
 */
module.exports = function generateSocketless(API) {
  const namespaces = Object.keys(API);

  return [
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
};
