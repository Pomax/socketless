import(`./socketless.js${location.search}`).then((lib) => {
  const { createBrowserClient } = lib;

  const create = (tag, classString, parent) => {
    const e = document.createElement(tag);
    e.setAttribute(`class`, classString);
    parent.appendChild(e);
    return e;
  };

  class BrowserClientClass {
    async init() {
      this.idField = create(`p`, `idfield`, document.body);
      this.testField = create(`p`, `testfield`, document.body);
      const result = await this.server.test(1, 2, 3);
      if (result !== `321`) {
        throw new Error(`Incorrect result received in the browser`);
      }
      window.test = this;
    }

    async update(prevState) {
      this.render();
    }

    render() {
      const { id, randomValue } = this.state;
      this.idField.textContent = id;
      this.testField.textContent = randomValue;
    }
  }

  createBrowserClient(BrowserClientClass);
});
