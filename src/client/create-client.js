module.exports = function(clientServer, ClientClass) {
  /**
   * This function creates a socket.io client with all the bells and
   * whistles taken care of so the user doesn't ever need to write
   * any socket.io code explicitly.
   */
  return function(serverURL) {
    // Set up a connection to the socket server and build a client instance.
    const socketToServer = require(`socket.io-client`)(serverURL);
    const instance = new ClientClass(/* clientServer.client */);

    // Ensure that clients receive a trigger when they connect to the server.
    socketToServer.on('connect', (...data) => {
      if (instance.onConnect) {
        instance.onConnect(...data);
      }
    });

    // And a trigger when they are disconnected from the server
    socketToServer.on('disconnect', (...data) => {
      if (instance.onDisconnect()) {
        instance.onDisconnect(...data);
      }
    });

    // And create the server proxy for the client to make direct calls to.
    instance.server = clientServer.client.createServer(socketToServer, instance);

    return instance;
  };
};
