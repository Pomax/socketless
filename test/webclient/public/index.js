import { createWebClient } from "./socketless.js";

console.log("script running");

const create = (tag, classString, parent) => {
  const e = document.createElement(tag);
  e.setAttribute(`class`, classString);
  parent.appendChild(e);
  return e;
};

class WebClient {
  async init() {
    this.idField = create(`p`, `idfield`, document.body);
    this.testField = create(`p`, `testfield`, document.body);
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

createWebClient(WebClient);
