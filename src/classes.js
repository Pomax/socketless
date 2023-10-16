import { proxySocket } from "./upgraded-socket.js";
import { CLIENT, SERVER } from "./sources.js";

const DEBUG = false;

const STATE_SYMBOL = Symbol();

/**
 * ...docs go here...
 */
export function formClientClass(ClientClass) {
  return class ClientBase extends ClientClass {
    // No functions except `disconnect` may be proxy-invoked
    static get disallowedCalls() {
      const names = Object.getOwnPropertyNames(ClientBase.prototype);
      [`constructor`, `disconnect`].forEach((name) =>
        names.splice(names.indexOf(name), 1),
      );
      return names;
    }

    constructor() {
      super();

      // unlike React, we don't even let you assign to state.
      const state = (this[STATE_SYMBOL] = {});
      const readOnlyState = new Proxy(state, {
        get: (_, prop) => state[prop],
        set: () => {
          throw new Error(
            `cannot directly assign to state, use setState(update)`,
          );
        },
      });

      Object.defineProperty(this, `state`, {
        value: readOnlyState,
        writable: false,
        configurable: false,
      });

      if (!this.onConnect) {
        this.onConnect = async () => {
          if (DEBUG)
            console.log(`[ClientBase] client ${this.state.id} connected.`);
        };
      }

      if (!this.onDisconnect) {
        this.onDisconnect = async () => {
          if (DEBUG)
            console.log(`[ClientBase] client ${this.state.id} disconnected.`);
        };
      }

      if (!this.onQuit) {
        this.onQuit = async () => {
          if (DEBUG)
            console.log(`[ClientBase] client ${this.state.id} quitting.`);
        };
      }
    }

    setState(stateUpdates) {
      if (DEBUG) console.log(`[ClientBase] updating state`);
      const state = this[STATE_SYMBOL];
      Object.entries(stateUpdates).forEach(
        ([key, value]) => (state[key] = value),
      );
    }

    connectServerSocket(serverSocket) {
      if (DEBUG) console.log(`[ClientBase]  connected to server`);
      this.server = proxySocket(CLIENT, SERVER, this, serverSocket);
      this.onConnect();
    }

    disconnect() {
      this.server.socket.close();
    }
  };
}

/**
 * ...docs go here...
 */
export function formServerClass(ServerClass) {
  return class ServerBase extends ServerClass {
    clients = [];
    ws = undefined; // websocket server instance
    webserver = undefined; // http(s) server instance

    // No functions in this class may be proxy-invoked
    static get disallowedCalls() {
      const names = Object.getOwnPropertyNames(ServerBase.prototype);
      names.splice(names.indexOf(`constructor`), 1);
      return names;
    }

    constructor(ws, webserver) {
      super();
      this.ws = ws;
      this.webserver = webserver;
    }

    // When a client connects to the server, route it to
    // the server.addClient(client) function for handling.
    async connectClientSocket(socket) {
      if (DEBUG) console.log(`[ServerBase] client connecting to server...`);
      const client = proxySocket(SERVER, CLIENT, this, socket);

      // send the client its server id
      if (DEBUG) console.log(`[ServerBase] sending connection id`);

      client.socket.send(
        JSON.stringify({
          name: `handshake:setid`,
          payload: { id: client.id },
        }),
      );

      if (DEBUG)
        console.log(`[ServerBase] adding client to list of known clients`);

      // add this client to the list
      this.clients.push(client);

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
        let pos = clients.findIndex((e) => e === client);
        if (pos !== -1) {
          let e = clients.splice(pos, 1)[0];
          this.onDisconnect(client);
        }
      });
    }

    async onDisconnect(client) {
      if (super.onDisconnect) return super.onDisconnect(client);
      if (DEBUG) console.log(`[ServerBase] client ${client.id} disconnected.`);
    }

    async onConnect(client) {
      if (super.onConnect) return super.onConnect(client);
      if (DEBUG) console.log(`[ServerBase] client ${client.id} connected.`);
    }

    async quit() {
      await this.onQuit();
      this.clients.forEach((client) => client.disconnect());
      // TODO: ideally, these three run in succession, but
      // we can't control "how fast" the webserver closes.
      this.webserver.close();
      this.ws.close();
      this.teardown();
    }

    async onQuit() {
      if (super.onQuit) return super.onQuit();
      if (DEBUG) console.log(`[ServerBase] told to quit.`);
    }

    async teardown() {
      if (super.teardown) return super.teardown();
      if (DEBUG) console.log(`[ServerBase] post-quit teardown.`);
    }
  };
}
