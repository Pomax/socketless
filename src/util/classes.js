export class ClientBase {
  state = {};

  setState(newState) {
    const { state } = this;
    Object.entries(newState).forEach(([key, value]) => (state[key] = value));
  }

  connectSocket(server, ...data) {
    this.server = server;
    this.data = data;
    this.onConnect();
  }

  async onConnect() {
    // ...
  }

  async onDisconnect() {
    // ...
  }
}

export class ServerBase {
  clients = [];

  constructor({ API, clientServer, namespaces, webserver, ws }) {
    this.API = API;
    this.clientServer = clientServer;
    this.namespaces = namespaces;
    this.ws = ws;
    this.webserver = webserver;
  }

  // When a client connects to the server, route it to
  // the server.addClient(client) function for handling.
  connectSocket(socket) {
    let client = this.clientServer.server.createClient(socket);
    socket.clientServer = { server: this, client };
    client.__socket = socket;

    // add this client to the list
    this.addClient(client);

    // Add client-removal handling for when the socket closes:
    this.addDisconnectHandling(client);

    // Make sure broadcasts to all client (by both the server,
    // and other clients) works:
    this.addBroadcastHandling(socket);

    // And then trigger the onConnect function for subclasses to do
    // whatever they want to do when a client connects to the server.
    this.onConnect(client);
  }

  addClient(client) {
    const { clients } = this;

    // Set a unique client-id
    const now = Date.now();
    const rnd = Math.random().toFixed(6).substring(2);
    Object.defineProperty(client, `id`, {
      writable: false,
      value: `${now}-${clients.length}-${rnd}`,
    });

    clients.push(client);
  }

  // Add client-removal handling when the socket closes:
  addDisconnectHandling(client) {
    const socket = client.__socket;
    const { clients } = this;

    socket.on(`close`, () => {
      let pos = clients.indexOf(client);
      if (pos !== -1) {
        clients.splice(pos, 1)[0];
        this.onDisconnect(client);
      }
    });
  }

  // make sure broadcasts to all client, by both the server, and other clients, works:
  addBroadcastHandling(socket) {
    const { clients, namespaces, API } = this;

    namespaces.forEach((namespace) => {
      API[namespace].client.forEach((fname) => {
        const broadcastData = (data) =>
          Promise.all(
            clients.map((client) =>
              client.__socket.upgraded.send(`${namespace}:${fname}`, data)
            )
          );

        // client-to-clients
        socket.upgraded.on(`broadcast:${namespace}:${fname}`, broadcastData);

        // server-to-clients
        if (!clients[namespace])
          Object.defineProperty(clients, namespace, {
            enumerable: false,
            value: {},
          });
        clients[namespace][fname] = broadcastData;
      });
    });
  }

  async onConnect(client) {
    console.log(`[SererBase] client ${client.id} connected.`);
  }

  async onDisconnect(client) {
    console.log(`[SererBase] client ${client.id} disconnected.`);
  }

  quit() {
    this.onQuit();
    this.clients.forEach((client) => client.disconnect());
    this.webserver.close(() => this.ws.close(() => this.teardown()));
  }

  async onQuit() {
    console.log(`[ServerBase] told to quit.`);
  }

  async teardown() {
    console.log(`[ServerBase] post-quit teardown.`);
  }
}
