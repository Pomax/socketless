export class ClientClass {
  constructor() {
    console.log("client> created");
  }

  async onConnect() {
    console.log("client> connected to server");
    setTimeout(
      () => {
        console.log("client> disconnecting");
        this.disconnect();
      },
      3000 + (2 * Math.random() - 1) * 1000
    );
    console.log("client> disconnecting in 3 +/- 1 seconds");

    this.name = `user-${(1e6 * Math.random()).toFixed(0)}`;
    this.registered = await this.server.setName(this.name);
    console.log(`client> registered as ${this.name}: ${this.registered}`);
  }
}
