import { Socketless } from "./socketless.js";

console.log("script running", Socketless);

const create = (tag, parent) => {
  const e = document.createElement(tag);
  parent.appendChild(e);
  return e;
};

class WebClient {
  async init() {
    this.idField = create(`p`, document.body);
    this.testField = create(`p`, document.body);
    console.log(`running init`);
    const result = await this.server.test(1, 2, 3);
    console.log(`result=${result}`);
    window.test = this;
  }

  async update(newState) {
    console.log(`setting new state:`, newState);
    this.state = newState;
    this.render();
  }

  render() {
    const { id, randomValue } = this.state;
    this.idField.textContent = id;
    this.testField.textContent = randomValue;
  }
}

Socketless.createWebClient(WebClient);
