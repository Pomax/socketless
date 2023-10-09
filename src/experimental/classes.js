import { proxySocket } from "./upgraded-socket.js";

export class ClientBase {
  state = {};

  setState(newState) {
    const { state } = this;
    Object.entries(newState).forEach(([key, value]) => (state[key] = value));
  }

  connectServerSocket(serverSocket, ...data) {
    this.server = proxySocket(`client`, this, serverSocket);
    this.onConnect(data);
  }

  disconnect() {
    this.server.socket.close();
  }

  async onConnect(data) {
    // ...
  }

  async onDisconnect() {
    // ...
  }
}

export class ServerBase {
  clients = [];

  constructor({ webserver, ws }) {
    this.ws = ws;
    this.webserver = webserver;
  }

  // When a client connects to the server, route it to
  // the server.addClient(client) function for handling.
  connectClientSocket(socket) {
    const client = proxySocket(`server`, this, socket);

    // add this client to the list
    this.clients.push({ client, socket });

    // Add client-removal handling for when the socket closes:
    this.addDisconnectHandling(client, socket);

    // And then trigger the onConnect function for subclasses to do
    // whatever they want to do when a client connects to the server.
    this.onConnect(client);
  }

  // Add client-removal handling when the socket closes:
  addDisconnectHandling(client, socket) {
    const { clients } = this;

    socket.on(`close`, () => {
      let pos = clients.findIndex(e => e.client === client);
      if (pos !== -1) {
        clients.splice(pos, 1)[0];
        this.onDisconnect(client);
      }
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
