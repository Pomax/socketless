/**
 * This is a demonstration client.
 */
class ClientClass {
  async updated(data) {
    // Called when connecting the browser to the real client,
    // to ensure the browser has the same state.
    console.log("client was bootstrapped using", data);
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
    if (this.users.indexOf(id) === -1) this.users.push(id);
    console.log(
      `browser client ${this.id}> user ${id} joined. Known users:`,
      this.users
    );
  }

  async "user:left"(id) {
    let pos = this.users.findIndex(u => u === id);
    if (pos > -1) this.users.splice(pos, 1);
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
