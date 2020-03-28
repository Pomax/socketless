class ServerClass {
  /**
   * ...
   */
  constructor() {
    console.log("server> created");
    this.games = [];
  }

  /**
   * ...
   */
  onConnect(client) {
    console.log(
      `server> new connection, ${this.clients.length} clients connected`
    );
    const id = this.games.length;
    client.setId(id);
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

  view all games
  start a game
  add a bot
  play a move

}

module.exports = ServerClass;
