import { createBrowserClient } from "./socketless.js";

class BrowserClient {
  runPassThroughTest(text) {
    this.server.passthroughReceived();
  }
}

createBrowserClient(BrowserClient);
