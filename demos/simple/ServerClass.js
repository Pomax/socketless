export class ServerClass {
  constructor() {
    console.log("server> created");
  }

  async onConnect(client) {
    console.log(
      `server> new connection: ${client.id}, ${this.clients.length} clients connected`,
    );
  }

  async onDisconnect(client) {
    console.log(`server> client ${client.id} disconnected`);
    if (this.clients.length === 0) {
      console.log(`server> no clients connected, shutting down.`);
      this.quit();
    }
  }

  async setName(client, name) {
    console.log(`server> client ${client.id} is now known as ${name}`);
    client.__name = name;
    return true;
  }
}
