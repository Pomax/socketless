module.exports = class GameClient {
  constructor() {
    this.id = -1;
    this.users = [];
    this.games = [];
  }

  onConnect() {}

  onDisconnect() {}

  async "admin:register"(id) {
    this.id = id;
    this.users = await this.server.user.getUserList();
    this.games = await this.server.game.getGameList();
  }

  async "user:joined"(id) {
    if (this.users.indexOf(id) === -1) this.users.push(id);
  }

  async "user:left"(id) {
    let pos = this.users.findIndex(u => u === id);
    if (pos > -1) this.users.splice(pos, 1);
  }

  async "user:changedName"({ id, name }) {
    // useful to human players, not very relevant to bots
  }

  async createGame() {
    this.server.game.create();
  }

  async "game:created"({ id, name }) {
    this.games.push({ id, name });
  }

  async joinGame(name) {
    let { joined, reason } = await this.server.game.join(name);
    if (joined) {
      this.inGame = name;
    } else {
      console.error(`could not join: ${reason}`);
    }
  }

  async "game:updated"(details) {
    // useful to human players, not very relevant to bots
  }

  async "game:start"({ name, players }) {
    console.log(`game ${name} started with players ${players}`);
    // get ready!
    return { ready: true };
  }
};
