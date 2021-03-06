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

    // TODO: slot into existing servers that are passed in the createServer call

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
      const clientId = `${Date.now()}-${clients.length}-${Math.random().toFixed(6).substring(2)}`;
      Object.defineProperty(client, `id`, {
        writable: false,
        value: clientId
      });

      // and make sure it'll get removed when it disconnects:
      socket.on(`close`, () => {
        let pos = clients.indexOf(client);
        clients.splice(pos, 1)[0];
        if (instance.onDisconnect) instance.onDisconnect(client);
      });

      // make sure broadcasts to all client, by both the server, and other clients, works:
      namespaces.forEach(namespace => {
        API[namespace].client.forEach(fname => {
          const broadcastData = (data) => Promise.all(
            clients.map(client =>
              client.__socket.upgraded.send(`${namespace}:${fname}`, data)
            )
          );

          // client-to-clients
          socket.upgraded.on(`broadcast:${namespace}:${fname}`, broadcastData);

          // server-to-clients
          if (!clients[namespace]) Object.defineProperty(clients, namespace, { enumerable: false, value: {}});
          clients[namespace][fname] = broadcastData;
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
