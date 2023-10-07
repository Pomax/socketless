// @ts-ignore: Node-specific import
import { WebSocket } from "ws";

export function createClient(clientServer, DefaultClientClass) {
  /**
   * This function creates a websocket client with all the bells and
   * whistles taken care of so the user doesn't ever need to write
   * any socket code explicitly.
   */
  return function createClient(serverURL, ClientClass = DefaultClientClass) {
    // Set up a connection to the socket server and build a client instance.
    const socketToServer = new WebSocket(serverURL);

    // Build a client and add state management
    const instance = new ClientClass();

    // Make sure the client is informed of disconnects.
    socketToServer.on(`close`, (...data) => {
      instance.onDisconnect(...data);
    });

    // And create the server proxy for the client to make direct
    // calls to, once the socket is ready for use, with a 'connect'
    // trigger to run custom code.
    //
    // TODO: this probably needs some clever code to handle any
    //       "before ready" communication...
    //
    socketToServer.on(`open`, (...data) => {
      const server = clientServer.client.createServer(socketToServer, instance);

      instance.connectSocket(server, ...data);
    });

    return instance;
  };
}
