// @ts-ignore: Node-specific import
import http from "http";
// @ts-ignore: Node-specific import
import https from "https";

import { WebSocketServer } from "ws";

export function createServer(clientServer, namespaces, ServerClass, API) {
  /**
   * This function creates a websocket server with all the bells and
   * whistles taken care of so the user doesn't ever need to write
   * any websocket code explicitly.
   */
  return function createServer(httpsOptions = undefined) {
    const webserver = httpsOptions
      ? https.createServer(httpsOptions)
      : http.createServer();

    const ws = new WebSocketServer({ server: webserver });

    // Create a server instance based on the provided server class
    const instance = new ServerClass({
      API,
      clientServer,
      namespaces,
      webserver,
      ws,
    });

    // Ensure that we bind API handlers for each client that connects
    ws.on(`connection`, function (socket) {
      namespaces.forEach((namespace) => {
        new clientServer.server[namespace].handler(socket, instance);
      });
      instance.connectSocket(socket);
    });

    return webserver;
  };
}
