import { createBrowserClient } from "./socketless.js";

let cfIteration = 1;

class BrowserClient {
  init() {
    this.current = this.state.v || 0;
  }

  update(prevState, changeFlags) {
    if (changeFlags) {
      if (!changeFlags.a.e) {
        throw new Error(`missing diff flag for "a.e"`);
      }

      // does adding work?
      if (cfIteration === 1 && changeFlags.a.e !== 1) {
        throw new Error(`wrong flag value for add (${changeFlags.a.e})`);
      }

      if (cfIteration > 1 && changeFlags.a.e !== 4) {
        throw new Error(`wrong flag value for array add (${changeFlags.a.e})`);
      }

      // does removal work?
      if (cfIteration === 2 && changeFlags.a.b.c !== 3) {
        throw new Error(`wrong flag value for remove (${changeFlags.a.b.c})`);
      }

      if (!changeFlags.a.b.d) {
        throw new Error(`missing diff flag for "a.b.d"`);
      }

      // does replacement work?
      if (cfIteration >= 2 && changeFlags.a.b.d !== 2) {
        throw new Error(`wrong flag value for replace (${changeFlags.a.b.d})`);
      }

      if (!changeFlags.v) {
        throw new Error(`missing diff flag for "v"`);
      }

      cfIteration++;
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
