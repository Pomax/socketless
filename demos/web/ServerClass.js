import { GameManager } from "./GameManager.js";

export class ServerClass {
  constructor() {
    log("created");
    this.gm = new GameManager();
  }

  onConnect(client) {
    log(`new connection, ${this.clients.length} clients connected`);
    client.admin.setId(client.id);
    client.game.list({ games: this.gm.getList() });
  }

  onDisconnect(client) {
    log(`client ${client.id} disconnected`);
    if (this.clients.length === 0) {
      log(`no clients connected, shutting down.`);
      this.quit();
    }
  }

  async "game:getList"(client) {
    return this.gm.getList();
  }

  notifyGameList() {
    this.clients.forEach((client) =>
      client.game.list({
        games: this.gm.getList(client),
      }),
    );
  }

  async "game:create"(client) {
    this.gm.create(client);
    this.notifyGameList();
  }

  async "game:join"(client, { gameId }) {
    this.gm.join(gameId, client);
    this.notifyGameList();
  }

  async "game:play"(client, { gameId, position }) {
    this.gm.play(gameId, client.id, position);
  }
}

function log(...data) {
  console.log("server>", ...data);
}
