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

}

module.exports = ClientClass;
