class WebUI {
  constructor() {
    document.getElementById('quit').addEventListener('click', evt => {
      this.client.quit();
    });
    setTimeout(() => this.test(), 500);
  }

  test() {
    this.server.test.receive();
  }

  update(state) {
    document.getElementById('div').textContent = state.value;
  }
}

export { WebUI };
