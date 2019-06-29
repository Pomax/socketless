/**
 * This is a demonstration server with the typical
 * "lobby" function for clients joining and leaving.
 */
class Server {
  constructor() {
    this.clientIdCounter = 0;
    this.users = [];
  }

  /**
   * Add a client to the list of connected clients,
   * which involves building a client object with some
   * administrative data, adding it to the list, and
   * notifying all other clients of the connection.
   */
  async onConnect(client) {
    const user = { id: this.clientIdCounter++, client };

    this.users.push(user);
    console.log(`server> client (id=${user.id}) connected to the server.`);

    // Clone the user list so we can notify "everyone except this client" of the join
    const otherUsers = this.users.slice();
    await client.admin.register(user.id);
    console.log(`server> client confirmed registration`);

    // Notify all users that this client propely joined
    otherUsers.forEach(other => other.client.user.joined(user.id));

    // And schdule a call in the future for this client
    // to say what its state digest is, for verification
    // purposes. We don't actually use this for anything
    // real, it's mostly there to show off a call.
    setTimeout(async () => {
      let digest = await client.admin.getStateDigest();
      console.log(`server> client digest = ${digest.value}`);
    }, 1000);
  }

  /**
   * When a client disconnects, remove them from the userlist;
   * If this was the last connected client: shut down.
   */
  async onDisconnect(client) {
    const userPos = this.users.findIndex(v => v.client === client);
    const user = this.users.splice(userPos, 1)[0];
    console.log(`server> client ${user.id} was disconnected.`);

    if (this.getConnectedClients().length === 0) {
      console.log(`server> nothing left to do, exiting...`);
      process.exit();
    }

    this.users.forEach(other => other.client.user.left(user.id));
  }

  // ========================================================
  // Server's API functions, which get "called" by the client
  // and use the : symbol, with quotes, to effect namespacing
  // ========================================================

  /**
   * Record the fact that a client provided a (new) name.
   */
  async "user:setName"(from, name) {
    const user = this.users.find(v => v.client === from);
    user.name = name;
    console.log(`server> client ${user.id} is now called "${name}"`);

    this.users.forEach(other => {
      if (other === user) return;
      other.client.user.changedName({ id: user.id, name: user.name });
    });
  }

  /**
   * Provide a client with the current userlist.
   */
  async "user:getUserList"() {
    console.log(`server> sending user list`);
    let list = this.users.map(c => c.id);
    console.log(`server> list = ${list}`);
    return list;
  }
}

module.exports = Server;
