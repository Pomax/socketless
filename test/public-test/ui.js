class WebUI {
  constructor() {
    const ui = document.createElement("div");
    ui.innerHTML = `<button id="quit">quit</button>`;
    ui.querySelector('#quit').addEventListener('click', () => this.quit());
    document.body.appendChild(ui);
    setTimeout(() => this.test(), 500);
  }

  test() {
    this.server.test.receive();
  }

  update(state) {
    if (state.value) {
      let div = document.createElement('div');
      div.id = "value";
      div.textContent = state.value;
      document.body.appendChild(div);
    }
  }
}

export { WebUI };
