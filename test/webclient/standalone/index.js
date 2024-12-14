import { createBrowserClient } from "./socketless.js";

class BrowserClient {
  async init() {
    try {
      await this.server.nonexistent();
    } catch (e) {
      this.quit();
    }
  }
}

createBrowserClient(BrowserClient);
