module.exports = function(clientServer, namespaces, ServerClass) {
  /**
   * This function creates a socket.io server with all the bells and
   * whistles taken care of so the user doesn't ever need to write
   * any socket.io code explicitly.
   */
  return function(https = false) {
    // Create a socket.io server
    const webserver = require(https ? "https" : "http").createServer();
    const io = require("socket.io")(webserver);

    // Create an instance of the API handler
    const instance = new ServerClass(/* clientServer.server */);

    // When a client connects to the server, route it to
    // the server.addClient(client) function for handling.
    const onConnect = socket => {
      let client = clientServer.server.createClient(socket);
      if (!instance.addClient) {
        throw new Error(
          `Server class "${
            ServerClass.name
          }" is missing the addClient(client) function`
        );
      }
      socket.clientServer = { client: { instance: client } };
      instance.addClient(client);
    };

    // Ensure that we bind API handlers for each client that connects
    io.on(`connection`, socket => {
      namespaces.forEach(namespace => {
        new clientServer.server[namespace].handler(socket, instance);
      });
      onConnect(socket);
    });

    // Add a binding so that people can get to this instance,
    // should they really need to. Which they shouldn't.
    webserver.clientServer = { server: instance };

    return webserver;
  };
};
