import { proxySocket } from "../upgraded-socket.js";
import { WEBCLIENT, BROWSER } from "../sources.js";
// @ts-ignore: Node-specific import
import { createPatch } from "rfc6902";

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
        this.browser = proxySocket(WEBCLIENT, BROWSER, this, browserSocket);
        this.browser.socket.__seq_num = 0;
        this.setState(this.state);
      }
    }

    disconnectBrowserSocket() {
      this.browser = undefined;
    }

    setState(stateUpdates) {
      console.log(`[WebClientBase] setState`);
      super.setState(stateUpdates);
      console.log(`[WebClientBase] client has browser?`, !!this.browser);
      if (this.browser) {
        console.log(`[WebClientBase] creating diff as part of setState`);
        const diff = createPatch(this.__oldState ?? {}, this.state);
        const payload = {
          state: diff,
          seq_num: ++this.browser.socket.__seq_num,
          diff: true,
        };
        console.log(
          `[WebClientBase] sending diff as part of setState:`,
          payload,
        );
        this.browser.socket.send(JSON.stringify(payload));
      }
      this.__oldState = JSON.parse(JSON.stringify(this.state));
    }

    syncState() {
      if (this.browser) {
        console.log(
          `[WebClientBase] running syncState (will respond with full state)`,
        );
        const fullState = JSON.parse(JSON.stringify(this.state));
        this.browser.socket.__seq_num = 0;
        console.log(`[WebClientBase] responding with full state:`, fullState);
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
