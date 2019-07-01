const Game = require("./game.js");

module.exports = class GameServer {
  constructor() {
    this.clientIdCounter = 0;
    this.users = [];
    this.games = [];
  }

  getUser(client) {
    return this.users.find(v => v.client === client);
  }

  getOthers(client) {
    return this.users.filter(v => v.client !== client);
  }

  async onConnect(client) {
    const user = { id: this.clientIdCounter++, client };
    const otherUsers = this.users.slice();
    this.users.push(user);
    await client.admin.register(user.id);
    otherUsers.forEach(other => other.client.user.joined(user.id));
  }

  async onDisconnect(client) {
    const userPos = this.users.findIndex(v => v.client === client);
    const user = this.users.splice(userPos, 1)[0];
    this.users.forEach(other => other.client.user.left(user.id));
  }

  async "user:setName"(from, name) {
    const user = this.getUser(from);
    user.name = name;
    this.users.forEach(other => {
      if (other !== user) {
        other.client.user.changedName({ id: user.id, name: user.name });
      }
    });
  }

  async "user:getUserList"() {
    return this.users.map(c => c.id);
  }

  async "game:getGameList"() {
    return this.games.map(g => g.name);
  }

  async "game:create"(from) {
    let user = this.getUser(from);
    let game = new Game(user);
    this.games.push(game);
    this.users.forEach(user =>
      user.client.game.created({
        id: user.id,
        name: game.name
      })
    );
  }

  async "game:join"(from, gameName) {
    let game = this.games.find(g => g.name === gameName);
    if (game) {
      if (!game.inProgress) {
        let user = this.getUser(from);
        let alreadyJoined = game.addPlayer(user);
        if (!alreadyJoined) {
          this.users.forEach(user =>
            user.client.game.updated(game.getDetails())
          );
          return { joined: true };
        }
        return { joined: false, reason: `already joined` };
      }
      return { joined: false, reason: `game already in progress` };
    }
    return { joined: false, reason: `no such game` };
  }

  async "game:start"(from, gameName) {
    let game = this.games.find(g => g.name === gameName);
    if (game) {
      let user = this.getUser(from);
      if (game.owner === user) {
        game.start();
        return { started: true };
      }
      return { started: false, reason: `not permitted` };
    }
    return { started: false, reason: `no such game` };
  }
};
