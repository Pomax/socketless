import { createBrowserClient } from "./socketless.js";

createBrowserClient(
  class {
    init() {
      const quit = document.createElement(`button`);
      quit.id = `quit`;
      document.body.appendChild(quit);
      quit.addEventListener(`click`, () => this.quit());
    }
  },
);
