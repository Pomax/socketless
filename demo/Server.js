/**
 * This is a demonstration server with the typical
 * "lobby" function for clients joining and leaving.
 */
class Server {
  constructor() {
    this.clientIdCounter = 0;
    this.clients = [];
  }

  /**
   * Add a client to the list of connected clients,
   * which involves building a client object with some
   * administrative data, adding it to the list, and
   * notifying all other clients of the connection.
   */
  async onConnect(client) {
    client = {
      id: this.clientIdCounter++,
      api: client
    };

    this.clients.push(client);

    console.log(
      `server> client connected to the server (assigned id ${client.id}).`
    );

    // Clone the user list so we can notify "everyone except this client" of the join
    const otherClients = this.clients.slice();
    await client.api.admin.register(client.id);
    console.log(`server> client confirmed registration`);

    // Notify all users that this client propely joined
    otherClients.forEach(other => other.api.user.joined(client.id));

    // And schdule a call in the future for this client
    // to say what its state digest is, for verification
    // purposes. We don't actually use this for anything
    // real, it's mostly there to show off a call.
    setTimeout(async () => {
      let digest = await client.api.admin.getStateDigest();
      console.log(`server> client digest = ${digest.value}`);
    }, 1000);
  }

  /**
   * When a client disconnects, remove them from the userlist;
   * If this was the last connected client: shut down.
   */
  async onDisconnect(client) {
    client = this.clients.find(v => v.api===client);

    console.log(`server> client ${client.id} was disconnected.`);

    if (this.getConnectedClients().length === 0) {
      console.log(`server> nothing left to do, exiting...`);
      process.exit();
    }

    this.clients.forEach(other => other.api.user.left(client.id));
  }

  // ========================================================
  // Server's API functions, which get "called" by the client
  // and use the : symbol, with quotes, to effect namespacing
  // ========================================================

  /**
   * Record the fact that a client provided a (new) name.
   */
  async "user:setName"(from, name) {
    const client = this.clients.find(v => v.api === from);
    client.name = name;
    console.log(`server> client ${client.id} is now called "${name}"`);

    this.clients.forEach(other => {
      if (other === client) return;
      other.api.user.changedName({ id: client.id, name: client.name });
    });
  }

  /**
   * Provide a client with the current userlist.
   */
  async "user:getUserList"() {
    console.log(`server> sending user list`);
    return this.clients.map(c => c.id);
  }
}

module.exports = Server;
