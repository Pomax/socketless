const Game = require("../core/game.js");

module.exports = class GameServer {
  constructor() {
    this.clientIdCounter = 0;
    this.users = [];
    this.games = [];
  }

  /**
   * 
   */
  getUser(client) {
    return this.users.find(v => v.client === client);
  }

  /**
   * 
   */
  getOthers(client) {
    return this.users.filter(v => v.client !== client);
  }

  /**
   * 
   */
  async onConnect(client) {
    const user = { id: this.clientIdCounter++, client };
    const otherUsers = this.users.slice();
    this.users.push(user);
    client.admin.register(user.id);
    otherUsers.forEach(other => other.client.user.joined(user.id));
  }

  /**
   * 
   */
  async onDisconnect(client) {
    const userPos = this.users.findIndex(v => v.client === client);
    const user = this.users.splice(userPos, 1)[0];
    this.users.forEach(other => other.client.user.left(user.id));

    // update all running games
    this.games.forEach(game => game.leave(user));
    this.games = this.games.filter(game => game.players.count === 0);
  }

  /**
   * 
   */
  async "user:setName"(from, name) {
    const user = this.getUser(from);
    user.name = name;
    this.users.forEach(u => u.client.user.changedName({
      id: user.id,
      name: user.name
    }));
  }

  /**
   * 
   */
  async "user:getUserList"() {
    return this.users.map(u => ({ id: u.id, name: u.name }));
  }

  /**
   * 
   */
  async "game:getGameList"() {
    return this.games.map(g => g.name);
  }

  /**
   * 
   */
  async "game:create"(from) {
    let user = this.getUser(from);
    let game = new Game(user);
    this.games.push(game);
    this.users.forEach(u =>
      u.client.game.created({
        id: user.id,
        name: game.name
      })
    );
  }

  /**
   * 
   */
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

  /**
   * 
   */
  async "game:leave"(from) {
    let user = this.getUser(from);
    let game = user.game;
    game.leave(user);

    // clean up empty games
    if (game.players.length === 0) {
      let pos = this.games.findIndex(g => g === game);
      this.games.splice(pos, 1);
      this.users.forEach(user => user.client.game.ended({ name: game.name }));
    }
  }

  /**
   * 
   */
  async "game:start"(from) {
    let user = this.getUser(from);
    let game = user.game;
    if (game) {
      if (game.owner === user) {
        if (!game.inProgress) {
          game.start();
          return { started: true };
        }
        return { started: false, reason: `game already in progress` };
      }
      return { started: false, reason: `not permitted` };
    }
    return { started: false, reason: `not in a game` };
  }

  /**
   * 
   */
  async "game:bonusTile"(from, { tilenumber }) {
    let user = this.getUser(from);
    let game = user.game;
    if (game) {
      let reason = game.playerDeclaredBonus(user, tilenumber);
      if (!reason) {
        return { accepted: true };
      }
      return { accepted: false, reason };
    }
    return { accepted: false, reason: `not in a game` };
  }

  /**
   * 
   */
  async "game:discardTile"(from, { tilenumber }) {
    let user = this.getUser(from);
    let game = user.game;
    if (game) {
      let reason = game.playerDiscarded(user, tilenumber);
      if (!reason) {
        return { accepted: true };
      }
      return { accepted: false, reason };
    }
    return { accepted: false, reason: `not in a game` };
  }

  /**
   * 
   */
  async "game:undoDiscard"(from) {
    let user = this.getUser(from);
    let game = user.game;
    if (game) {
      let reason = game.undoDiscard(user);
      if (!reason) {
        return { allowed: true };
      }
      return { allowed: false, reason };
    }
    return { allowed: false, reason: `not in a game` };
  }

  /**
   * 
   */
  async "game:pass"(from) {
    let user = this.getUser(from);
    let game = user.game;
    if (game) {
      game.playerPasses(user);
    }
  }

  /**
   * 
   */
  async "game:claim"(from, { claimtype, wintype }) {
    let user = this.getUser(from);
    let game = user.game;
    if (game) {
      game.playerClaim(user, claimtype, wintype);
      return { allowed: true };
    }
    return { allowed: false, reason: `not in a game` };
  }

  /**
   * 
   */
  async "game:declareWin"(from) {
    let user = this.getUser(from);
    let game = user.game;
    if (game)
      game.declareWin({
        id: user.id,
        seat: user.seat
      });
  }
};
