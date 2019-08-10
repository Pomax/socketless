const User = require("../game/user.js");
const Game = require("../game/game.js");

module.exports = class GameServer {
  constructor() {
    this.users = [];
    this.games = [];
  }

  // A helper function for getting a user object given a client socket
  getUser(client) {
    return this.users.find(p => p.client === client);
  }

  // A helper funciton to get every user object except
  // the one associated with this client socket.
  getOthers(client) {
    return this.users.filter(p => p.client !== client);
  }

  /**
   * When a client connects, build a user object around it,
   * and assign the client a unique id.
   */
  async onConnect(client) {
    const user = new User(client);
    const others = this.users.slice();
    this.users.push(user);
    user.register();
    others.forEach(u => u.userJoined(user));
  }

  /**
   * When a client disconnects, remove the associated user
   * object, and remove it from any games it might be in,
   * cleaning up any games that drop to 0 players as a result.
   */
  async onDisconnect(client) {
    const userPos = this.users.findIndex(u => u.client === client);
    const user = this.users.splice(userPos, 1)[0];
    this.users.forEach(u => u.userLeft(user));

    // update all running games
    this.games.forEach(game => game.leave(user));
    this.games = this.games.filter(game => game.players.count === 0);
  }

  /**
   * Have a user indicate a new name.
   */
  async "user:setName"(from, name) {
    const user = this.getUser(from);
    user.setName(name);
    this.users.forEach(u => u.userChangedName(user.id, name));
  }

  /**
   * Send clients the known user list on request.
   */
  async "user:getUserList"() {
    return this.users.map(u => u.getDetails());
  }

  /**
   * Send clients the known games list on request.
   */
  async "game:getGameList"() {
    return this.games.map(g => g.getDetails());
  }

  /**
   * Create a game, automatically binding the creating
   * user as the game's "owner".
   */
  async "game:create"(from) {
    let user = this.getUser(from);
    let game = new Game(user);
    this.games.push(game);
    this.users.forEach(u => u.gameCreated(user.id, game.name));
  }

  /**
   * Try to join a user to a game, explaining why this
   * could not be done in any of the many possible cases.
   */
  async "game:join"(from, gameName) {
    let game = this.games.find(g => g.name === gameName);
    if (game) {
      if (!game.inProgress) {
        let user = this.getUser(from);
        let alreadyJoined = game.addPlayer(user);
        if (!alreadyJoined) {
          let details = game.getDetails();
          this.users.forEach(u => u.updateGame(details));
          return { joined: true };
        }
        return { joined: false, reason: `already joined` };
      }
      return { joined: false, reason: `game already in progress` };
    }
    return { joined: false, reason: `no such game` };
  }

  /**
   * Try to remove a user from a game, cleaning up any games
   * that drop to 0 players as a result.
   */
  async "game:leave"(from) {
    let user = this.getUser(from);
    let game = user.game;
    game.leave(user);

    // clean up empty games
    if (game.players.length === 0) {
      let pos = this.games.findIndex(g => g === game);
      this.games.splice(pos, 1);
      this.users.forEach(u => u.gameEnded());
    }
  }

  /**
   * Start a game on request, explaining why this
   * could not be done in any of the many possible cases.
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
   * Forward the fact that a player has a bonus tile to the
   * game that player is playing in, explaining why this
   * could not be done in any of the many possible cases.
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
   * Forward the fact that a player discarded a tile in the
   * game that player is playing in, explaining why this
   * could not be done in any of the many possible cases.
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
   * Forward an "undo discard" request from a player.
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
   * Forward a "pass on discard" by a player.
   */
  async "game:pass"(from) {
    let user = this.getUser(from);
    let game = user.game;
    if (game) {
      game.playerPasses(user);
    }
  }

  /**
   * Forward a discard claim by a player.
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
   * Forward a win declaration by a player.
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
