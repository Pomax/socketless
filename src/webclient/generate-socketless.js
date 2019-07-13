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
 *
 * This is done the crude way rather than using something like webpack or
 * rollup mainly because I hate dependencies for things that don't need them.
 * Would the bundle be smaller? No. Would it be cleaner? Irrelevant: the
 * browser cares about whether it can parse the code, not whether it wins
 * on style points (plus, have you ever tried reading a webpack bundle?).
 * Would it take a build step and tens of megabytes of dependencies? Yep.
 */
module.exports = function generateSocketless(API) {
  const namespaces = Object.keys(API);

  return [
    fs
      .readFileSync(
        path.join(
          __dirname,
          `../../node_modules/morphdom/dist/morphdom-umd.min.js`
        )
      )
      .toString("utf-8"),

    fs
      .readFileSync(
        path.join(__dirname, `../../node_modules/jsonpatch/jsonpatch.min.js`)
      )
      .toString("utf-8"),

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

    // also, this part is unreasonably hard to do with webpack:
    `
      const namespaces = ${JSON.stringify(namespaces)};
      const API = ${JSON.stringify(API)};
      return ${generateProxyClientServer.toString()}(WebClientClass);
    `,

    `}}`
  ].join(`\n`);
};
