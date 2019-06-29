/**
 * This is a demonstration client.
 */
class ClientClass {
  async updated() {
    // update the page in a silly way
    document.querySelector('#clientid').textContent = this.id;

    const el = document.createElement('ul');
    this.users.forEach(u => {
      let li = document.createElement('li');
      li.textContent = u;
      el.appendChild(li);
    });
    let ul = document.querySelector('#list ul');
    ul.parentNode.replaceChild(el, ul);
  }

  async "admin:register"(clientId) {
    // this function will have kicked in before a browser
    // was connected, so we don't need any code here.
  }

  async "admin:getStateDigest"() {
    console.log(`browser client ${this.id}> state digest requested.`);
    return { value: `${Math.random()} from browser` };
  }

  async "user:joined"(id) {
    if (this.users.indexOf(id) === -1) {
      this.users.push(id);
      this.updated();
    }
    console.log(
      `browser client ${this.id}> user ${id} joined. Known users:`,
      this.users
    );
  }

  async "user:left"(id) {
    let pos = this.users.findIndex(u => u === id);
    if (pos > -1) {
      this.users.splice(pos, 1);
      this.updated();
    }
    console.log(
      `browser client ${this.id}> user ${id} left. Known users:`,
      this.users
    );
  }

  async "user:changedName"({ id, name }) {
    console.log(
      `browser client ${this.id}> user ${id} changed name to ${name}.`
    );
  }

  async "chat:message"({ id, message }) {
    if (id === this.id) return;
    console.log(
      `browser client ${this.id}> received chat message from ${id}: ${message}`
    );
  }
}

export default ClientClass;
