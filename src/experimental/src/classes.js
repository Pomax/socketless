import { proxySocket } from "./upgraded-socket.js";
import { log } from "./logger.js";
import { createPatch } from "rfc6902";

export class ClientBase {
  // The socketless factory will inject:
  //
  // - state = {}

  setState(stateUpdates) {
    console.log(`updating state`);
    const { state } = this;
    const oldState = JSON.parse(JSON.stringify(state));
    Object.entries(stateUpdates).forEach(
      ([key, value]) => (state[key] = value)
    );
    console.log(`[setstate] client has browser?`, !!this.browser);
    if (this.browser) {
      console.log(`creating diff`);
      const diff = createPatch(oldState, state);
      console.log(`sending diff`);
      diff.push({ value: ++this.browser.socket.__seq_num });
      this.browser.socket.send(
        JSON.stringify({
          state: diff,
          diff: true,
        })
      );
    }
  }

  connectBrowserSocket(browserSocket) {
    if (!this.browser) {
      // note that there is no auth here (yet)
      this.browser = proxySocket(`browser`, this, browserSocket);
      this.browser.socket.__seq_num = 0;
      this.setState(this.state);
    }
  }

  syncState() {
    if (this.browser) {
      const fullState = JSON.parse(JSON.stringify(this.state));
      console.log(this.state);
      this.browser.socket.__seq_num = 0;
      return fullState;
    }
    throw new Error("Cannot sync state: no browser attached to client.");
  }

  disconnectBrowserSocket() {
    this.browser = undefined;
  }

  connectServerSocket(serverSocket) {
    console.log(`client: connected to server`);
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
    console.log(`server: client connecting to server...`);
    const client = proxySocket(`server`, this, socket);

    // send the client its server id
    console.log(`server: sending connection id`);

    client.socket.send(
      JSON.stringify({
        name: `handshake:setid`,
        payload: { id: client.id },
      })
    );

    console.log(`server: adding client to list of known clients`);

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
