const generateSetupHandlers = require("./setup-handlers.js");

module.exports = function(clientServer, namespaces) {
  /**
   * This function creates a socket.io server with all the bells and
   * whistles taken care of so the user doesn't ever need to write
   * any socket.io code explicitly.
   */
  return function(ServerClass, https = false) {
    // Create a socket.io server
    const webserver = require(https ? "https" : "http").createServer();
    const io = require("socket.io")(webserver);

    // Create an instance of the API handler
    const instance = new ServerClass(/* clientServer.server */);

    // Set up handling of client connections
    const setupHandlers = generateSetupHandlers(clientServer, namespaces);
    setupHandlers(instance, io, socket => {
      let client = clientServer.server.createClient(socket);
      if (!instance.addClient) {
        throw new Error(
          `Server class "${
            ServerClass.name
          }" is missing the addClient(client) function`
        );
      }
      instance.addClient(client);
    });

    // Add a binding so that people can get to this instance,
    // should they really need to. Which they shouldn't.
    webserver.clientServer = { server: instance };

    return webserver;
  };
};
