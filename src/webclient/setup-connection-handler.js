import { upgradeSocket } from "../util/upgrade-socket.js";
import { setupSyncFunctionality } from "./setup-sync-functionality.js";

export function setupConnectionHandler(sockets, API, directSync = false) {
  const namespaces = Object.keys(API);

  // Allow for socket binding and setting up call handling
  return function handleBrowserConnection(socket) {
    let client = sockets.client;
    let server = client.server;

    // record connection from browser and send a bootstrap instruction.
    const browser = (sockets.browser = upgradeSocket(socket));
    client.browser_connected = true;

    if (client.onBrowserConnect) {
      client.onBrowserConnect();
    }

    // set up the sync functionality
    setupSyncFunctionality(sockets, socket, directSync);

    // Set up proxy functions for routing browser => server
    namespaces.forEach((namespace) => {
      API[namespace].server.forEach((fname) => {
        // event transport always uses `:` as namespace separator.
        socket.upgraded.on(`${namespace}:${fname}`, async (data, respond) => {
          respond(await server[namespace][fname](data));
        });
      });
    });

    // set up a keepalive message every 45 seconds
    const keepalive = setInterval(() => {
      const ack = browser.upgraded.send(`keepalive`);
      if (!ack) {
        console.log("client seems to have gotten lost...");
      }
    }, 45000);

    // Add a quit() handler so the browser can "kill" the client:
    socket.upgraded.on("quit", async () => {
      await server.disconnect();
      if (client.onQuit) client.onQuit();
      clearInterval(keepalive);
    });
  };
}
