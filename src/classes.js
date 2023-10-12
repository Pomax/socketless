import { proxySocket } from "./upgraded-socket.js";

// @ts-ignore: Node-specific import
import { createPatch } from "rfc6902";

/**
 * ...docs go here...
 */
export class ClientBase {
  // The socketless factory will also inject this
  state = {};

  setState(stateUpdates) {
    console.log(`updating state`);
    const { state } = this;
    const oldState = JSON.parse(JSON.stringify(state));
    Object.entries(stateUpdates).forEach(
      ([key, value]) => (state[key] = value),
    );
    console.log(`[setstate] client has browser?`, !!this.browser);
    if (this.browser) {
      console.log(`creating diff`);
      const diff = createPatch(oldState, state);
      console.log(`sending diff`);
      this.browser.socket.send(
        JSON.stringify({
          state: diff,
          seq_num: ++this.browser.socket.__seq_num,
          diff: true,
        }),
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

  quit() {
    if (this.browser) {
      this.browser.socket.close();
      this.disconnectBrowserSocket();
    }
    this.disconnect();
    this.onQuit();
  }

  async onConnect() {
    console.log(`[ClientBase] client ${this.state.id} connected.`);
  }

  async onDisconnect() {
    console.log(`[ClientBase] client ${this.state.id} disconnected.`);
  }

  async onQuit() {
    console.log(`[ClientBase] client ${this.state.id} quitting.`);
  }
}

/**
 * ...docs go here...
 */
export class ServerBase {
  // The socketless factory will also inject these:
  clients = [];
  ws = undefined; // websocket server instance
  webserver = undefined; // http(s) server instance

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
      }),
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
        let e = clients.splice(pos, 1)[0];
        this.onDisconnect(client);
      }
    });
  }

  async onConnect(client) {
    console.log(`[ServerBase] client ${client.id} connected.`);
  }

  async onDisconnect(client) {
    console.log(`[ServerBase] client ${client.id} disconnected.`);
  }

  async quit() {
    await this.onQuit();
    this.clients.forEach((client) => client.disconnect());
    this.webserver.close(() => this.ws.close(() => this.teardown()));
  }

  async onQuit() {
    console.log(`[ServerBase] told to quit.`);
  }

  teardown() {
    console.log(`[ServerBase] post-quit teardown.`);
  }
}
