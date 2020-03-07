const fs = require(`fs`);
const path = require(`path`);
const generateProxyClientServer = require(`./generate-proxy-client-server.js`);

/**
 * create a "bundle" consisting of:
 *
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
module.exports = function generateSocketless(API, directSync) {
  const namespaces = Object.keys(API);
  return [
    // Include a full copy of the rfc6902 patch/diff/apply library. This
    // is non-optional and not so much "a build step" as simply "we know
    // where it lives, add it".
    fs
      .readFileSync(require.resolve(`rfc6902/dist/rfc6902.min.js`))
      .toString(`utf-8`),

    // We then build our builder:
    `
    const ClientServer = {
      generateClientServer: function(WebClientClass) {
        const exports = {};`,

    // Which should include our socket upgrade code...
    fs
      .readFileSync(path.join(__dirname, `../upgrade-socket.js`))
      .toString(`utf-8`)
      .replace(`module.exports = upgradeSocket;`, ``),

    // and the rest of the library code.
    `
        const namespaces = ${JSON.stringify(namespaces)};
        const API = ${JSON.stringify(API)};
        return ${generateProxyClientServer.toString()}(WebClientClass, ${directSync});
      }
    };`
  ].join(`\n`);
};
