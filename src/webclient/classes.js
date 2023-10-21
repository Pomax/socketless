import { proxySocket } from "../upgraded-socket.js";
import { WEBCLIENT, BROWSER } from "../sources.js";
// @ts-ignore: Node-specific import
import { createPatch } from "rfc6902";

const DEBUG = false;

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
      // allow quit() and syncState() to be called
      [`constructor`, `quit`, `syncState`].forEach((name) =>
        names.splice(names.indexOf(name), 1),
      );
      // but of course don't allow access to the "special" properties
      names.push(`browser`, `ws`, `webserver`);
      return names;
    }

    constructor() {
      super();
      if (!this.onBrowserConnect) {
        this.onBrowserConnect = async (browser) => {
          if (DEBUG) console.log(`[WebClientBase] browser connected.`);
        };
      }
      if (!this.onBrowserDisconnect) {
        this.onBrowserDisconnect = async (browser) => {
          if (DEBUG) console.log(`[WebClientBase] browser disconnected.`);
        };
      }
    }

    connectBrowserSocket(browserSocket) {
      if (this.browser) {
        // We don't allow more than one browser to connect
        browserSocket.close();
      } else {
        // Note that there is no auth here. this is left up to devs to implement.
        this.browser = proxySocket(WEBCLIENT, BROWSER, this, browserSocket);
        this.browser.socket.__seq_num = 0;
        this.setState(this.state);
        this.onBrowserConnect(this.browser);
      }
    }

    disconnectBrowserSocket() {
      this.onBrowserDisconnect(this.browser);
      this.browser = undefined;
    }

    setState(stateUpdates) {
      if (DEBUG) console.log(`[WebClientBase] setState`);
      super.setState(stateUpdates);
      if (DEBUG)
        console.log(`[WebClientBase] client has browser?`, !!this.browser);
      if (this.browser) {
        if (DEBUG)
          console.log(`[WebClientBase] creating diff as part of setState`);
        const diff = createPatch(this.__oldState ?? {}, this.state);
        if (diff.length > 0) {
          const payload = {
            state: diff,
            seq_num: ++this.browser.socket.__seq_num,
            diff: true,
          };
          if (DEBUG)
            console.log(
              `[WebClientBase] sending diff as part of setState:`,
              payload,
            );
          this.browser.socket.send(JSON.stringify(payload));
        } else {
          if (DEBUG) console.log(`no difference, skipping state sync.`);
        }
      }
      this.__oldState = JSON.parse(JSON.stringify(this.state));
    }

    syncState() {
      if (this.browser) {
        if (DEBUG)
          console.log(
            `[WebClientBase] running syncState (will respond with full state)`,
          );
        const fullState = JSON.parse(JSON.stringify(this.state));
        this.browser.socket.__seq_num = 0;
        if (DEBUG)
          console.log(`[WebClientBase] responding with full state:`, fullState);
        return fullState;
      }
      throw new Error(
        "[WebClientBase] Cannot sync state: no browser attached to client.",
      );
    }

    async quit() {
      if (this.browser) {
        this.browser.socket.close();
        this.disconnectBrowserSocket();
      }
      this.disconnect();
      await this.onQuit();
      this.ws.close();
      this.webserver.closeAllConnections();
      this.webserver.close(() => this.teardown());
    }

    async onQuit() {
      super.onQuit?.();
      if (DEBUG) console.log(`[WebClient] client ${this.id} told to quit.`);
    }

    async teardown() {
      super.teardown?.();
      if (DEBUG) console.log(`[WebClient] client ${this.id} running teardown.`);
    }
  };
}
