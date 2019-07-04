const sortTiles = (a, b) => a - b;

module.exports = class GameClient {
  constructor() {
    this.state = {
      id: -1,
      chat: [],
      users: [],
      games: [],
      players: []
    }
  }

  onConnect() {}

  onDisconnect() {}

  async "admin:register"(id) {
    this.setState({
      id: id,
      users: await this.server.user.getUserList(),
      games: await this.server.game.getGameList()
    });
  }

  async "chat:message"({ id, message }) {
    this.state.chat.push({ id, message });
  }

  async "user:joined"(id) {
    let users = this.state.users;
    if (users.indexOf(id) === -1) users.push(id);
  }

  async "user:left"(id) {
    let users = this.state.users;
    let pos = users.findIndex(u => u === id);
    if (pos > -1) users.splice(pos, 1);
  }

  async "user:changedName"({ id, name }) {
    // useful to human players, not very relevant to bots
  }

  async "game:created"({ id, name }) {
    this.state.games.push({ id, name });
  }

  async "game:updated"(details) {
    // useful to human players, not very relevant to bots
  }

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

  async "game:setWind"({ seat, wind }) {
    this.setState({
      seat: seat,
      wind: wind
    });
  }

  async "game:initialDeal"(tiles) {
    this.state.tiles = tiles.sort(sortTiles);
  }

  async "game:draw"(tilenumber) {
    let tiles = this.state.tiles;
    tiles.push(tilenumber);
    tiles.sort(sortTiles);
  }

  setSeat(seat) {
    this.setState({
      currentDiscard: false,
      currentPlayer: seat
    });
  }

  async "game:setCurrentPlayer"(seat) {
    this.setSeat(seat);
  }

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

  async "game:playerTookBack"({ id, seat, tilenumber }) {
    this.state.currentDiscard = false;
    if (id === this.state.id) {
      let tiles = this.state.tiles;
      tiles.push(tilenumber);
      tiles.sort(sortTiles);
    }
  }

  async "game:playerPassed"({ id, seat }) {
    // useful to human players, not very relevant to bots
  }

  async "game:claimAwarded"(claim) {
    this.setSeat(claim.seat);
    if (claim.id === this.state.id) this.lock(claim);
    else {
      let player = this.state.players[claim.seat];
      if (!player.locked) player.locked = [];
      player.locked.push(claim);
    }
  }

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

  async "game:playerWon"(winner) {
    this.state.winner = winner;
  }
};
