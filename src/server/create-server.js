module.exports = function(clientServer, namespaces, ServerClass, API) {
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
    const instance = new ServerClass();

    // Set up a clients list
    let clients = [];

    // And give the instance a way to access it
    instance.getConnectedClients = () => clients;

    // When a client connects to the server, route it to
    // the server.addClient(client) function for handling.
    const onConnect = function(socket) {
      // record the connected client:
      let client = clientServer.server.createClient(socket);

      // add a binding that can be used by client-call-handler
      socket.clientServer = { client: { instance: client } };

      client.__socket = socket;
      clients.push(client);

      // and make sure it'll get removed when it disconnects:
      socket.on(`disconnect`, () => {
        let pos = clients.indexOf(client);
        clients.splice(pos, 1)[0];
        if (instance.onDisconnect) instance.onDisconnect(client);
      });

      // also make sure broadcasts to all client, by clients, work:
      namespaces.forEach(namespace => {
        API[namespace].client.forEach(fname => {
          socket.on(`broadcast:${namespace}:${fname}`, data => {
            clients.forEach(client => {
              client.__socket.emit(`${namespace}:${fname}`, data);
            });
          });
        });
      });

      // and then call connected(client)
      if (instance.onConnect) instance.onConnect(client);
    };

    // Ensure that we bind API handlers for each client that connects
    const connectSocket = function(socket) {
      namespaces.forEach(namespace => {
        new clientServer.server[namespace].handler(socket, instance);
      });
      onConnect(socket);
    };

    io.on(`connection`, connectSocket);
    io.on(`reconnect`, connectSocket);

    // Add a binding so that people can get to this instance,
    // should they really need to. Which they shouldn't.
    webserver.clientServer = { server: instance };

    return webserver;
  };
};
