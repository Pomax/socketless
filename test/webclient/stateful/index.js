import { createBrowserClient } from "./socketless.js";

class BrowserClient {
  init() {
    this.current = this.state.v || 0;
  }
  update(prevState, changeFlags) {
    if (changeFlags) {
      if (!changeFlags.a.e) {
        throw new Error(`missing diff flag for "a.e"`);
      }

      if (!changeFlags.a.b.d) {
        throw new Error(`missing diff flag for "a.b.d"`);
      }

      if (!changeFlags.v) {
        throw new Error(`missing diff flag for "v"`);
      }
    }

    if (this.state.v === this.current + 1) {
      this.current++;
      if (this.current === 5) {
        this.disconnect();
        document.body.classList.add(`done`);
      }
    }
  }
}

createBrowserClient(BrowserClient);
