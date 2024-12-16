import { createBrowserClient } from "./socketless.js";

class BrowserClient {
  init() {
    // check tests for initial state object
    this.runTests();
    this.server.updateValue();
  }

  update() {
    const { state } = this;
    if (state.a.b.c !== 1) {
      throw new Error(`did not receive a.b.c?`);
    }
    // recheck tests for updated  state object
    this.runTests();
    this.quit();
  }

  runTests() {
    let msg;

    // Reassigning this.state should be impossible
    msg = `should not have been able to reassign this.state`;
    try {
      this.state = {};
      throw new Error(msg);
    } catch (e) {
      if (e.message === msg) throw e;
      // if this is not our own message, all is well.
    }

    // Assigning properties in this.state should be impossible
    msg = `should not have been able to add .a to this.state`;
    try {
      this.state.a = 12345;
      throw new Error(msg);
    } catch (e) {
      if (e.message === msg) throw e;
      // if this is not our own message, all is well.
    }

    // This should be perfectly allowed:
    const state = this.getStateCopy();
    state.a = `test`;
  }
}

createBrowserClient(BrowserClient);
