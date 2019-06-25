module.exports = function(clientServer) {
  /**
   * This function creates a socket.io client with all the bells and
   * whistles taken care of so the user doesn't ever need to write
   * any socket.io code explicitly.
   */
  return function(serverURL, ClientClass) {
    // Set up a connection to the socket server and build a client instance
    const socketToServer = require(`socket.io-client`)(serverURL);
    const instance = new ClientClass(/* clientServer.client */);

    // create the server proxy for the client to make direct calls to.
    instance.server = clientServer.client.createServer(socketToServer, instance);
  };
};
