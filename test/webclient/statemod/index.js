import { createBrowserClient } from "./socketless.js";

console.log(`building`);

class BrowserClient {
  update(prevState) {
    // attempt to modify state
    this.state.a.b = "d";
  }
}

createBrowserClient(BrowserClient);
