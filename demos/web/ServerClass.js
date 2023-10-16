import { GameManager } from "./GameManager.js";

export class ServerClass {
  constructor() {
    console.log("server created");
    this.gm = new GameManager();

    this.game = {
      getList: (client) => {
        return this.gm.getList();
      },
      create: (client) => {
        this.gm.create(client);
        this.notifyGameList();
      },
      join: (client, { gameId }) => {
        this.gm.join(gameId, client);
        this.notifyGameList();
      },
      play: (client, { gameId, position }) => {
        this.gm.play(gameId, client.id, position);
      },
    };
  }

  async onConnect(client) {
    console.log(`new connection, ${this.clients.length} clients connected`);
    await client.admin.setId(client.id);
    await client.game.list({ games: this.gm.getList() });
  }

  onDisconnect(client) {
    console.log(`client ${client.id} disconnected`);
    if (this.clients.length === 0) {
      console.log(`no clients connected, shutting down.`);
      this.quit();
    }
  }

  teardown() {
    // FIXME: I don't like this...
    process.exit(0);
  }

  notifyGameList() {
    this.clients.forEach((client) => {
      const games = this.gm.getList(client);
      client.game.list({ games });
    });
  }
}
