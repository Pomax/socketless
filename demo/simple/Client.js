function generateRandomName() {
  let empty = new Array(10).fill(0);
  let chars = empty.map(v => String.fromCharCode(97 + 26 * Math.random()));
  return chars.join("");
}

/**
 * This is a demonstration client.
 */
class Client {
  constructor() {
    this.id = -1;
    this.users = [];
  }

  onConnect() {
    console.log(`client> connected to server.`);
  }

  onDisconnect() {
    console.log(`client ${this.id}> was disconnected from server.`);
  }

  // ========================================================
  // Client's API functions, which get "called" by the server
  //    and use the $ symbol to effect handler namespacing

  /**
   * Register ourselves as being part of the collective now.
   */
  async admin$register(clientId) {
    console.log(`client> received registration id ${clientId}`);
    this.id = clientId;

    // come up with a random name
    let name = (this.name = generateRandomName());
    console.log(`client ${this.id}> setting name to ${name}`);
    this.server.user.setName(name);

    // Request the user list
    console.log(`client ${this.id}> requesting user list`);
    let list = await this.server.user.getUserList();
    console.log(`client ${this.id}> received user list`, list);
    this.users = list;

    // Broadcast a chat message after 10 seconds.
    setTimeout(() => {
      console.log(`client ${this.id}> broadcasting a chat message`);
      this.server.broadcast(this.chat$message, {
        id: clientId,
        message: `test ${Math.random()}`
      });
    }, 10000);

    // Schedule a disconnect after 15 seconds.
    if (!this.is_web_client) {
      setTimeout(async () => {
        console.log(`client ${this.id}> disconnecting from server.`);
        this.server.disconnect();
      }, 15000);
    }

    return { status: `registered` };
  }

  /**
   * Provide the server with a full state digest upon request.
   * This is something a server may occasionally call in order
   * to verify that the client's knowledge of "all the things"
   * has not been corrupted (due to networking/timing issues,
   * for example, or because someone modified their client).
   */
  async admin$getStateDigest() {
    console.log(`client ${this.id}> state digest requested.`);
    return { value: Math.random() };
  }

  /**
   * Record the fact that another user joined the collective
   */
  async user$joined(id) {
    if (this.users.indexOf(id) === -1) this.users.push(id);
    console.log(
      `client ${this.id}> user ${id} joined. Known users:`,
      this.users
    );
  }

  /**
   * Record the fact that some user left the collective
   */
  async user$left(id) {
    let pos = this.users.findIndex(u => u === id);
    if (pos > -1) this.users.splice(pos, 1);
    console.log(`client ${this.id}> user ${id} left. Known users:`, this.users);
  }

  /**
   * Note that a user changed their name
   */
  async user$changedName({ id, name }) {
    console.log(`client ${this.id}> user ${id} changed name to ${name}.`);
  }

  /**
   * Handle chat messages, which we know are the result of
   * client broadcasts, so we need to ignore any sent "by us".
   */
  async chat$message({ id, message }) {
    let msg = `received chat message from ${id}: ${message}`;
    if (id === this.id) msg = `saw own chat message.`;
    console.log(`client ${this.id}> ${msg}`);
  }
}

module.exports = Client;
