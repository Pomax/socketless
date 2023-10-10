import { proxySocket } from "./upgraded-socket.js";
import { log } from "./logger.js";

export class ClientBase {
  // The socketless factory will inject:
  //
  // - state = {}

  setState(newState) {
    const { state } = this;
    Object.entries(newState).forEach(([key, value]) => (state[key] = value));
  }

  connectServerSocket(serverSocket) {
    this.server = proxySocket(`client`, this, serverSocket);
    this.onConnect();
  }

  disconnect() {
    this.server.socket.close();
  }

  async onConnect() {
    log(`[ClientBase] client ${this.state.id} connected.`);
  }

  async onDisconnect() {
    log(`[ClientBase] client ${this.state.id} disconnected.`);
  }
}

export class ServerBase {
  // The socketless factory will inject:
  //
  // - clients = [],
  // - ws = websocket server, and
  // - webserver = http(s) server;

  // When a client connects to the server, route it to
  // the server.addClient(client) function for handling.
  async connectClientSocket(socket) {
    const client = proxySocket(`server`, this, socket);

    // send the client its server id
    client.socket.send(
      JSON.stringify({ name: `handshake:setid`, payload: { id: client.id } })
    );

    // add this client to the list
    this.clients.push({ client, socket });

    // Add client-removal handling for when the socket closes:
    this.addDisconnectHandling(client, socket);

    // And then trigger the onConnect function for subclasses to do
    // whatever they want to do when a client connects to the server.
    this.onConnect(client);
  }

  // Add client-removal handling when the socket closes:
  async addDisconnectHandling(client, socket) {
    const { clients } = this;

    socket.on(`close`, () => {
      let pos = clients.findIndex((e) => e.client === client);
      if (pos !== -1) {
        clients.splice(pos, 1)[0];
        this.onDisconnect(client);
      }
    });
  }

  async onConnect(client) {
    log(`[ServerBase] client ${client.id} connected.`);
  }

  async onDisconnect(client) {
    log(`[ServerBase] client ${client.id} disconnected.`);
  }

  async quit() {
    await this.onQuit();
    this.clients.forEach((client) => client.disconnect());
    this.webserver.close(() => this.ws.close(() => this.teardown()));
  }

  async onQuit() {
    log(`[ServerBase] told to quit.`);
  }

  teardown() {
    log(`[ServerBase] post-quit teardown.`);
  }
}
