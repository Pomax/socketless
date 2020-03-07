const WebSocket = require("ws");
const attach = require("../util/attach");

// TODO: allow passing in a preexisting server?

module.exports = function(clientServer, namespaces, ServerClass, API) {
  /**
   * This function creates a websocket server with all the bells and
   * whistles taken care of so the user doesn't ever need to write
   * any websocket code explicitly.
   */
  return function createServer(https = false) {
    // Create a websocket server
    const webserver = require(https ? "https" : "http").createServer();
    const ws = new WebSocket.Server({ server: webserver });

    // Create an instance of the API handler
    const instance = new ServerClass();

    // with a binding to the server
    attach(instance, `__webserver`, webserver);

    // Set up a clients list
    let clients = [];

    // And give the instance a way to access it
    attach(instance, `clients`, clients);

    // Also make sure servers can quit.
    attach(instance, `quit`, () => {
      [ws, webserver].forEach(w => w.close());
      if (instance.onQuit) {
        instance.onQuit();
      }
    });

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
      socket.on(`close`, () => {
        let pos = clients.indexOf(client);
        clients.splice(pos, 1)[0];
        if (instance.onDisconnect) instance.onDisconnect(client);
      });

      // also make sure broadcasts to all client, by clients, work:
      namespaces.forEach(namespace => {
        API[namespace].client.forEach(fname => {
          socket.upgraded.on(`broadcast:${namespace}:${fname}`, data => {
            clients.forEach(client => {
              client.__socket.upgraded.send(`${namespace}:${fname}`, data);
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

    ws.on(`connection`, connectSocket);

    // Add a binding so that people can get to this instance,
    // should they really need to. Which they shouldn't.
    webserver.clientServer = { server: instance };

    return webserver;
  };
};
