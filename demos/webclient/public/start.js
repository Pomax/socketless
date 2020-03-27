let eventCount = 0;

class WebUI {
  constructor() {
    setTimeout(() => this.test(), 500);
  }

  test() {
    this.server.test.receive();
  }

  eventTest(data) {
    this.server.test.events(data);

    if (++eventCount === 2) {
      const ui = document.createElement("div");
      ui.innerHTML = `<button id="quit">quit</button>`;
      ui.querySelector("#quit").addEventListener("click", () => {
        this.quit();
      });
      document.body.appendChild(ui);
    }
  }

  update(state) {
    if (state.value) {
      let div = document.createElement("div");
      div.id = "value";
      div.textContent = state.value;
      document.body.appendChild(div);
    }
  }
}

const ui = ClientServer.generateClientServer(WebUI);

document.addEventListener("webclient:update", evt => {
  let copied = {...evt.detail};
  ui.client.eventTest(copied);
});
