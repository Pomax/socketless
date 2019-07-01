const upgradeSocket = require("../upgrade-socket.js");
const setupSyncFunctionality = require("./setup-sync-functionality.js");

module.exports = function setupConnectionHandler(sockets, API) {
  const namespaces = Object.keys(API);

  // Allow for socket binding and setting up call handling
  return function handleBrowserConnection(socket) {
    let client = sockets.client;
    let server = client.server;

    // record connection from browser and send a bootstrap instruction.
    browser = sockets.browser = upgradeSocket(socket);
    client.browser_connected = true;

    // set up the sync functionality
    setupSyncFunctionality(sockets, socket);

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
  }
};
