import { proxySocket } from "../upgraded-socket.js";
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
        ClientClass.disallowedCalls
      );
      [`constructor`, `quit`, `syncState`].forEach((name) =>
        names.splice(names.indexOf(name), 1)
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
          })
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
        "[WebClientBase] Cannot sync state: no browser attached to client."
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
