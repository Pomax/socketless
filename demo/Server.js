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
  async addClient(client) {
    // Set up a client object
    const clientId = this.clientIdCounter++;
    const clientObj = {
      client: client,
      name: undefined,
      id: clientId
    };

    console.log(
      `server> client connected to the server (assigned id ${clientId}).`
    );

    // It's often useful to be able to do something when clients disconnect.
    client.onDisconnect(() => this.disconnectClient(clientObj));

    // Clone the user list so we can notify "everyone except this client" of the join
    const otherClients = this.clients.slice();

    // Register this client
    this.clients[clientId] = clientObj;
    const confirmed = await client.admin.register(clientId);
    clientObj.confirmed = confirmed;
    console.log(`server> client confirmed registration`);

    // Notify all users that this client propely joined
    otherClients.forEach(clientObj =>
      clientObj.client.user.joined(clientId)
    );

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
  async disconnectClient(clientObj) {
    let pos = this.clients.indexOf(clientObj);
    if (pos !== -1) {
      let removed = this.clients.splice(pos, 1)[0];
      this.clients.forEach(clientObj =>
        clientObj.client.user.left(removed.id)
      );
    }

    console.log(`server> client ${clientObj.id} was disconnected.`);

    if (this.clients.length === 0) {
      console.log(`server> nothing left to do, exiting...`);
      process.exit();
    }
  }

  // ========================================================
  // Server's API functions, which get "called" by the client
  // and use the : symbol, with quotes, to effect namespacing
  // ========================================================

  /**
   * Record the fact that a client provided a (new) name.
   */
  async "user:setName"(from, name) {
    const client = this.clients.find(v => v.client===from);
    client.name = name;
    console.log(`server> client ${client.id} is now called "${name}"`);

    this.clients.forEach(other => {
      if (other===client) return;
      other.client.user.changedName({
        id: client.id,
        name: client.name
      });
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
