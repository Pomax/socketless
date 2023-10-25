import { createBrowserClient } from "./socketless.js";

class BrowserClient {
  constructor() {
    this.current = 0;
  }
  update(prevState) {
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
