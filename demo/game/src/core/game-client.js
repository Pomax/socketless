const sortTiles = (a, b) => a - b;

module.exports = class GameClient {
  constructor() {
    this.state = {
      id: -1,
      chat: [],
      users: [],
      games: [],
      players: []
    };
  }

  /**
   * 
   */
  onConnect() {}

  /**
   * 
   */
  onDisconnect() {}

  /**
   * 
   */
  onQuit() {
    console.log("Shutting down client.");
    process.exit(0);
  }

  /**
   * 
   */
  async "admin:register"(id) {
    this.setState({
      id: id,
      users: await this.server.user.getUserList(),
      games: await this.server.game.getGameList()
    });
  }

  /**
   * 
   */
  async "chat:message"({ id, message }) {
    this.state.chat.push({ id, message });
  }

  /**
   * 
   */
  async "user:joined"(id) {
    let user = this.state.users.find(u => u.id === id);
    if (!user) {
      this.state.users.push({ id });
    }
  }

  /**
   * 
   */
  async "user:left"(id) {
    let pos = this.state.users.findIndex(u => u.id === id);
    if (pos > -1) this.state.users.splice(pos, 1);
  }

  /**
   * 
   */
  async "user:changedName"({ id, name }) {
    let user = this.state.users.find(u => u.id === id);
    if (user) user.name = name;
  }

  /**
   * 
   */
  async "game:created"({ id, name }) {
    this.state.games.push({ id, name, players: [{ id }] });
  }

  /**
   * 
   */
  async "game:updated"(details) {
    let pos = this.state.games.findIndex(g => g.name === details.name);
    if (pos > -1) this.state.games[pos] = details;
  }

  /**
   * 
   */
  async "game:start"({ name, players }) {
    this.setState({
      currentGame: name,
      players: players,
      tiles: [],
      bonus: [],
      locked: [],
      winner: false,
      currentDiscard: false
    });

    this.state.games.find(g => g.name === name).inProgress = true;

    return { ready: true };
  }

  /**
   * 
   */
  async "game:ended"({ name }) {
    let pos = this.state.games.findIndex(g => g.name === name);
    this.state.games.splice(pos, 1);
  }

  /**
   * 
   */
  async "game:setWind"({ seat, wind }) {
    this.setState({
      seat: seat,
      wind: wind
    });
  }

  /**
   * 
   */
  async "game:initialDeal"(tiles) {
    tiles.sort(sortTiles);
    this.state.bonus = tiles.filter(t => (t >= 34));
    this.state.tiles = tiles.filter(t => (t <= 33));
    this.state.bonus.forEach(tilenumber => this.server.game.bonusTile({ tilenumber }));
  }

  /**
   * 
   */
  async "game:playerDeclaredBonus"({ id, seat, tilenumber }) {
    let player = this.state.players[seat];
    if (!player.bonus) player.bonus = [];
    player.bonus.push(tilenumber);
    player.bonus.sort(sortTiles);
  }

  /**
   * 
   */
  async "game:draw"(tilenumber) {
    if (tilenumber >= 34) {
      this.state.bonus.push(tilenumber);
      this.state.bonus.sort(sortTiles);
      this.server.game.bonusTile({ tilenumber });
      return;
    }

    let tiles = this.state.tiles;
    tiles.push(tilenumber);
    tiles.sort(sortTiles);
    this.state.latestTile = tilenumber;
  }

  /**
   * 
   */
  setSeat(seat) {
    this.setState({
      latestTile: false,
      currentDiscard: false,
      currentPlayer: seat
    });
  }

  /**
   * 
   */
  async "game:setCurrentPlayer"(seat) {
    this.setSeat(seat);
  }

  /**
   * 
   */
  async "game:playerDiscarded"({ id, seat, tilenumber }) {
    if (id === this.state.id) {
      let tiles = this.state.tiles;
      let pos = tiles.indexOf(tilenumber);
      if (pos !== -1) {
        tiles.splice(pos, 1);
      } else {
        console.log(`${tiles} does not contain ${tilenumber}?`);
      }
    }
    this.state.currentDiscard = { id, seat, tilenumber };
  }

  /**
   * 
   */
  async "game:playerTookBack"({ id, seat, tilenumber }) {
    this.state.currentDiscard = false;
    if (id === this.state.id) {
      let tiles = this.state.tiles;
      tiles.push(tilenumber);
      tiles.sort(sortTiles);
    }
  }

  /**
   * 
   */
  async "game:playerPassed"({ id, seat }) {
    // useful to human players, not very relevant to bots
  }

  /**
   * 
   */
  async "game:claimAwarded"(claim) {
    this.setSeat(claim.seat);
    if (claim.id === this.state.id) this.lock(claim);
    else {
      let player = this.state.players[claim.seat];
      if (!player.locked) player.locked = [];
      player.locked.push(claim);
    }
  }

  /**
   * 
   */
  lock({ tilenumber, claimtype, wintype }) {
    if (claimtype === "win") {
      claimtype = wintype;
    }

    let set,
      t = tilenumber,
      tiles = this.state.tiles;

    if (claimtype === "pair") set = [t];
    if (claimtype === "chow1") set = [t + 1, t + 2];
    if (claimtype === "chow2") set = [t - 1, t + 1];
    if (claimtype === "chow3") set = [t - 2, t - 1];
    if (claimtype === "pung") set = [t, t];
    if (claimtype === "kong") set = [t, t, t];

    set.forEach(t => {
      let pos = tiles.indexOf(t);
      tiles.splice(pos, 1);
    });

    set.push(t);

    this.state.locked.push(set.sort(sortTiles));
  }

  /**
   * 
   */
  async "game:playerWon"(winner) {
    this.state.winner = winner;
    this.server.broadcast(this["game:reveal"], {
      seat: this.state.seat,
      tiles: this.state.tiles
    });
  }

  /**
   * 
   */
  async "game:reveal"({ seat, tiles }) {
    let player = this.state.players.find(p => p.seat === seat);
    player.tiles = tiles;
  }

  /**
   * 
   */
  async "game:left"({ seat }) {
    if (seat === this.state.seat) {
      this.state.currentGame = false;
    } else {
      let player = this.state.players.find(p => p.seat === seat);
      player.left = true;
    }
  }
};
