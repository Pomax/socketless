import { ClientServer } from "./socketless.js";

let eventCount = 0;

class WebUI {
  constructor() {
    // console.log(`browser: ui constructor`)
    setTimeout(() => this.test(), 10);
  }

  test() {
    // console.log(`browser: test()`)
    this.server.test.receive();
  }

  eventTest(data) {
    // console.log(`browser: eventTest(data)`)

    this.server.test.events(data);

    if (++eventCount === 2) {
      const ui = document.createElement("div");
      ui.innerHTML = `<button id="quit">quit</button>`;
      ui.querySelector("#quit").addEventListener("click", () => {
        // console.log(`browser: #quit clicked`)
        this.quit();
      });
      document.body.appendChild(ui);
    }
  }

  update(state) {
    // console.log(`browser: update(state)`)
    if (state.value) {
      let div = document.createElement("div");
      div.id = "value";
      div.textContent = state.value;
      document.body.appendChild(div);
    }
  }
}

const ui = ClientServer.generateClientServer(WebUI);

document.addEventListener("webclient:update", (evt) => {
  let copied = { ...evt.detail };
  ui.client.eventTest(copied);
});
