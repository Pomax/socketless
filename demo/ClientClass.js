class ClientClass {
  constructor() {
    console.log("client> created");
  }

  onConnect() {
    console.log("client> connected to server");
    setTimeout(() => this.server.disconnect(), 3000 + (Math.random()<0.5 ? -1 : 1) * (Math.random() * 1000));
    console.log("client> disconnecting in 3 +/- 1 seconds");
  }

  async "startup:register"() {
    this.name = `user${Date.now()}`;
    this.registered = await this.server.user.setName(this.name);
    console.log(`client> registered as ${this.name}: ${this.registered}`);
  }
}

module.exports = ClientClass;
