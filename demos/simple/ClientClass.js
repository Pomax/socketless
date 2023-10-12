import { ClientBase } from "socketless";

export class ClientClass extends ClientBase {
  /**
   * ...
   */
  constructor(...args) {
    super(...args);
    console.log("client> created");
  }

  /**
   * ...
   */
  onConnect() {
    console.log("client> connected to server");
    setTimeout(
      () => this.server.disconnect(),
      3000 + (Math.random() < 0.5 ? -1 : 1) * (Math.random() * 1000),
    );
    console.log("client> disconnecting in 3 +/- 1 seconds");
  }

  /**
   * ...
   */
  async "startup:register"() {
    this.name = `user-${Date.now()}-${Math.random()
      .toString()
      .substring(2, 8)}}`;
    this.registered = await this.server.user.setName(this.name);
    console.log(`client> registered as ${this.name}: ${this.registered}`);
  }
}
