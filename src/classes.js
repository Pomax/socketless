import { proxySocket } from "./upgraded-socket.js";
// @ts-ignore: Node-specific import
import { createPatch } from "rfc6902";

const DEBUG = false;

/**
 * ...docs go here...
 */
export function formClientClass(ClientClass) {
  return class ClientBase extends ClientClass {
    state = {};

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
      const { state } = this;
      Object.entries(stateUpdates).forEach(
        ([key, value]) => (state[key] = value),
      );
    }

    connectServerSocket(serverSocket) {
      if (DEBUG) console.log(`[ClientBase]  connected to server`);
      this.server = proxySocket(`client`, this, serverSocket);
      this.onConnect();
    }

    disconnect() {
      this.server.socket.close();
    }
  };
}

/**
 * In order to create an appropriate webclient class, we need to extend
 * off of "whatever the user's client class is".
 * @param {*} ClientClass
 * @returns
 */
export function formWebClientClass(ClientClass) {
  return class WebClient extends ClientClass {
    browser = undefined;

    // No functions except `quit` and `syncState` may be proxy-invoked
    static get disallowedCalls() {
      const names = Object.getOwnPropertyNames(WebClient.prototype).concat(
        ClientClass.disallowedCalls,
      );
      [`constructor`, `quit`, `syncState`].forEach((name) =>
        names.splice(names.indexOf(name), 1),
      );
      return names;
    }

    connectBrowserSocket(browserSocket) {
      if (!this.browser) {
        // note that there is no auth here (yet)
        this.browser = proxySocket(`browser`, this, browserSocket);
        this.browser.socket.__seq_num = 0;
        this.setState(this.state);
      }
    }

    disconnectBrowserSocket() {
      this.browser = undefined;
    }

    setState(stateUpdates) {
      const oldState = JSON.parse(JSON.stringify(this.state));
      super.setState(stateUpdates);
      if (DEBUG)
        console.log(`[WebClientBase] client has browser?`, !!this.browser);
      if (this.browser) {
        if (DEBUG) console.log(`[WebClientBase] creating diff`);
        const diff = createPatch(oldState, this.state);
        if (DEBUG) console.log(`[WebClientBase] sending diff`);
        this.browser.socket.send(
          JSON.stringify({
            state: diff,
            seq_num: ++this.browser.socket.__seq_num,
            diff: true,
          }),
        );
      }
    }

    syncState() {
      if (this.browser) {
        const fullState = JSON.parse(JSON.stringify(this.state));
        if (DEBUG) console.log(this.state);
        this.browser.socket.__seq_num = 0;
        return fullState;
      }
      throw new Error(
        "[WebClientBase] Cannot sync state: no browser attached to client.",
      );
    }

    quit() {
      if (this.browser) {
        this.browser.socket.close();
        this.disconnectBrowserSocket();
      }
      this.disconnect();
      this.onQuit();
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

    async onConnect(client) {
      if (super.onConnect) return super.onConnect(client);
      if (DEBUG) console.log(`[ServerBase] client ${client.id} connected.`);
    }

    async onDisconnect(client) {
      if (super.onDisconnect) return super.onDisconnect(client);
      if (DEBUG) console.log(`[ServerBase] client ${client.id} disconnected.`);
    }

    async onQuit() {
      if (super.onQuit) return super.onQuit();
      if (DEBUG) console.log(`[ServerBase] told to quit.`);
    }

    async teardown() {
      if (super.teardown) return super.teardown();
      if (DEBUG) console.log(`[ServerBase] post-quit teardown.`);
    }

    // When a client connects to the server, route it to
    // the server.addClient(client) function for handling.
    async connectClientSocket(socket) {
      if (DEBUG) console.log(`[ServerBase] client connecting to server...`);
      const client = proxySocket(`server`, this, socket);

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

    async quit() {
      await this.onQuit();
      this.clients.forEach((client) => client.disconnect());
      this.webserver.close(() => this.ws.close(() => this.teardown()));
    }
  };
}
