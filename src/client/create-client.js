const addStateManagement = require("./add-state-management.js");
const WebSocket = require("ws");

module.exports = function(clientServer, DefaultClientClass) {
  /**
   * This function creates a websocket client with all the bells and
   * whistles taken care of so the user doesn't ever need to write
   * any socket code explicitly.
   */
  return function(serverURL, ClientClass = DefaultClientClass) {
    // Set up a connection to the socket server and build a client instance.
    const socketToServer = new WebSocket(serverURL);

    // Build a client and add state management
    const instance = addStateManagement(new ClientClass());

    // Ensure that clients receive a trigger when they connect to the server.
    socketToServer.on(`connect`, (...data) => {
      if (instance.onConnect) {
        instance.onConnect(...data);
      }
    });

    // And a trigger when they are disconnected from the server
    socketToServer.on(`close`, (...data) => {
      if (instance.onDisconnect) {
        instance.onDisconnect(...data);
      }
    });

    // And create the server proxy for the client to make direct
    // calls to, once the socket is ready for use.
    //
    // TODO: this probably needs some clever code to handle any
    //       "before ready" communication...
    socketToServer.onopen = () => {
      instance.server = clientServer.client.createServer(
        socketToServer,
        instance
      );
    };

    return instance;
  };
};
