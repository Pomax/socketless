class ClientClass {
  /**
   * ...
   */
  constructor() {
    console.log("client> created");
  }

  /**
   * ...
   */
  onConnect() {
    console.log("client> connected to server");
  }

  /**
   * ...
   */
  async "startup:register"() {
    this.name = `user${Date.now()}`;
    this.registered = await this.server.user.setName(this.name);
    console.log(`client> registered as ${this.name}: ${this.registered}`);
  }
}

module.exports = ClientClass;
