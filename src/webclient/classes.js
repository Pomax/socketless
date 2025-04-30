import { createSocketProxy } from "../upgraded-socket.js";
import { WEBCLIENT, BROWSER, deepCopy } from "../utils.js";
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
      names.push(
        `browser`,
        `ws`,
        `webServer`,
        // @deprecated
        `webserver`,
      );
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

    async init() {
      super.init?.();
      if (DEBUG) console.log(`[WebClientBase] running init()`);
    }

    connectBrowserSocket(browserSocket) {
      if (this.browser) {
        // We don't allow more than one browser to connect
        browserSocket.close();
      } else {
        // Note that there is no auth here. this is left up to devs to implement.
        this.browser = createSocketProxy(
          browserSocket,
          this,
          WEBCLIENT,
          BROWSER,
        );
        this.browser.socket.__seq_num = 0;
        this.setState(this.state);
        this.onBrowserConnect(this.browser);
      }
    }

    disconnectBrowserSocket() {
      if (this.browser) {
        const browser = this.browser;
        this.browser = undefined;
        this.onBrowserDisconnect(browser);
      }
    }

    setState(stateUpdates) {
      if (DEBUG) console.log(`[WebClientBase] setState`);
      super.setState(stateUpdates);
      if (DEBUG)
        console.log(`[WebClientBase] client has browser?`, !!this.browser);
      let currentState = this.state;
      if (this.browser) {
        if (DEBUG)
          console.log(`[WebClientBase] creating diff as part of setState`);

        // Don't send any state information if the client needs the
        // user to be authenticated and they have not yet done so:
        const authenticated =
          currentState.authenticated === undefined ||
          currentState.authenticated === true;
        if (!authenticated) currentState = { authenticated: false };

        const diff = createPatch(this.__oldState ?? {}, currentState);
        if (diff.length > 0) {
          const payload = {
            diff,
            seq_num: ++this.browser.socket.__seq_num,
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
      this.__oldState = deepCopy(currentState);
    }

    syncState() {
      if (this.browser) {
        if (DEBUG)
          console.log(
            `[WebClientBase] running syncState (will respond with full state)`,
          );
        const fullState = deepCopy(this.state);
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
      this.webServer.closeAllConnections();
      this.webServer.close(() => this.teardown());
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
