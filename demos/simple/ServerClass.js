import { ServerBase } from "socketless";

export class ServerClass extends ServerBase {
  /**
   * ...
   */
  constructor(...args) {
    super(...args);
    console.log("server> created");
  }

  /**
   * ...
   */
  onConnect(client) {
    console.log(
      `server> new connection, ${this.clients.length} clients connected`
    );
    client.startup.register();
  }

  /**
   * ...
   */
  onDisconnect(client) {
    console.log(`server> client ${client.name} disconnected`);
    if (this.clients.length === 0) {
      console.log(`server> no clients connected, shutting down.`);
      this.quit();
    }
  }

  /**
   * ...
   */
  async "user:setName"(client, name) {
    console.log(`server> client is now known as ${name}`);
    client.name = name;
    return true;
  }
}
