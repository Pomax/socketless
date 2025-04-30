import { createBrowserClient } from "./socketless.js";

class BrowserClient {
  init() {
    const props = Object.keys(this.state);
    if (props.length > 1) {
      this.client.fail(`too many props: ${props}`);
    }
  }
  update() {
    if (this.state.authenticated === true) {
      const { a, b, c } = this.state;
      this.client.setResult(a, b, c);
    }

    if (this.state.authenticated === false) {
      this.client.authenticate(`user`, `password`, `12345`);
    }
  }
}

createBrowserClient(BrowserClient);
