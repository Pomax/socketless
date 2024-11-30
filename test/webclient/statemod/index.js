import { createBrowserClient } from "./socketless.js";

class BrowserClient {
  init() {
    // attempt to modify state
    console.log(`will this work?`);
    this.state = {};
    console.log(`this worked?`);
  }
}

createBrowserClient(BrowserClient);
