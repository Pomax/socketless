import { createSocketProxy } from "./upgraded-socket.js";
import { CLIENT, SERVER, deepCopy } from "./utils.js";
import { applyPatch } from "rfc6902";

const DEBUG = false;

const STATE_SYMBOL = Symbol(`state symbol`);

/**
 * ...docs go here...
 */
export function formClientClass(ClientClass) {
  return class ClientBase extends ClientClass {
    // Special data silo for JSON-diff based syncing from the server,
    // so that the client doesn't need to built a local data structure
    // that is already being maintained by the server.
    #server_sync_silo = {};
    #server_sync_seq_num = 0;
    #apply_server_sync_patch(patch, seqNum) {
      // out-of-order update?
      if (seqNum !== this.#server_sync_seq_num + 1) return false;
      this.#server_sync_seq_num++;
      const results = applyPatch(this.#server_sync_silo, patch);
      return results.every((e) => e === null);
    }
    #set_server_sync_silo(data, seqNum) {
      this.#server_sync_silo = deepCopy(data);
      this.#server_sync_seq_num = seqNum;
      return true;
    }
    async __data_sync({ data, patch, seqNum = 0, forced = false }) {
      let result;
      if (forced) {
        result = this.#set_server_sync_silo(data, seqNum);
      } else {
        result = this.#apply_server_sync_patch(patch, seqNum);
      }
      process.nextTick(() => {
        this.onSyncUpdate(deepCopy(this.#server_sync_silo), forced);
      });
      return result;
    }

    async onSyncUpdate(silo, forced) {
      super.onSyncUpdate?.(silo, forced);
      if (DEBUG) console.log(`[ClientBase] received silo update.`);
    }

    static get disallowedCalls() {
      // No functions in this class may be proxy-invoked
      const names = Object.getOwnPropertyNames(ClientBase.prototype);
      // (except for `disconnect` and `__data_sync`)
      [`constructor`, `disconnect`, `__data_sync`].forEach((name) =>
        names.splice(names.indexOf(name), 1),
      );
      // Nor should the following properties be accessible
      names.push(`server`, `state`, `params`);
      return names;
    }

    constructor() {
      super();
      // disallow writing directly into state
      // TODO: this needs to have proxy-based deep protection. Right now it's only single level.
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
    }

    async init() {
      super.init?.();
      if (DEBUG) console.log(`[ClientBase] running init()`);
    }

    async onError(error) {
      super.onError?.(error);
      if (DEBUG) console.log(`[ClientBase] some kind of error occurred.`);
    }

    onConnect() {
      super.onConnect?.();
      if (DEBUG) console.log(`[ClientBase] client ${this.state.id} connected.`);
    }

    onDisconnect() {
      super.onDisconnect?.();
      if (DEBUG)
        console.log(`[ClientBase] client ${this.state.id} disconnected.`);
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
      this.server = createSocketProxy(serverSocket, this, CLIENT, SERVER);
      this.onConnect();
    }

    disconnect() {
      this.server?.socket.close();
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
    webServer = undefined; // http(s) server instance

    static get disallowedCalls() {
      // No functions in this class may be proxy-invoked
      const names = Object.getOwnPropertyNames(ServerBase.prototype);
      names.splice(names.indexOf(`constructor`), 1);
      // Nor should these server-specific properties be accessible to clients
      names.push(
        `clients`,
        `ws`,
        `webServer`,
        // @deprecated
        `webserver`,
      );
      return names;
    }

    constructor(ws, webServer) {
      super();
      this.ws = ws;
      this.webServer = webServer;
    }

    async init() {
      super.init?.();
      if (DEBUG) console.log(`[ServerBase] running init()`);
    }

    // When a client connects to the server, route it to
    // the server.addClient(client) function for handling.
    async connectClientSocket(socket) {
      if (DEBUG) console.log(`[ServerBase] client connecting to server...`);
      const client = createSocketProxy(socket, this, SERVER, CLIENT);

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

    async onError(error) {
      super.onError?.(error);
      if (DEBUG) console.log(`[ServerBase] some kind of error occurred.`);
    }

    async onConnect(client) {
      super.onConnect?.(client);
      if (DEBUG) console.log(`[ServerBase] client ${client.id} connected.`);
    }

    async onDisconnect(client) {
      super.onDisconnect?.(client);
      if (DEBUG) console.log(`[ServerBase] client ${client.id} disconnected.`);
    }

    async quit() {
      await this.onQuit();
      this.clients.forEach((client) => client.disconnect());
      this.ws.close();
      this.webServer.closeAllConnections();
      this.webServer.close(() => this.teardown());
    }

    async onQuit() {
      super.onQuit?.();
      if (DEBUG) console.log(`[ServerBase] told to quit.`);
    }

    async teardown() {
      super.teardown?.();
      if (DEBUG) console.log(`[ServerBase] post-quit teardown.`);
    }
  };
}
