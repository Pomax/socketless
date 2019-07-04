const sortTiles = (a, b) => a - b;

module.exports = class GameClient {
  constructor() {
    this.id = -1;
    this.chat = [];
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

  async "chat:message"({ id, message }) {
    this.chat.push({ id, message });
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

  async "game:created"({ id, name }) {
    this.games.push({ id, name });
  }

  async "game:updated"(details) {
    // useful to human players, not very relevant to bots
  }

  async "game:start"({ name, players }) {
    this.currentGame = name;
    this.players = players;
    this.tiles = [];
    this.bonus = [];
    this.locked = [];
    this.games.find(g => g.name === name).inProgress = true;
    return { ready: true };
  }

  async "game:setWind"({ seat, wind }) {
    this.seat = seat;
    this.wind = wind;
  }

  async "game:initialDeal"(tiles) {
    this.tiles = tiles.sort(sortTiles);
  }

  async "game:draw"(tilenumber) {
    this.tiles.push(tilenumber);
    this.tiles.sort(sortTiles);
  }

  setSeat(seat) {
    this.currentDiscard = false;
    this.currentPlayer = seat;
  }

  async "game:setCurrentPlayer"(seat) {
    this.setSeat(seat);
  }

  async "game:playerDiscarded"({ id, seat, tilenumber }) {
    if (id === this.id) {
      let pos = this.tiles.indexOf(tilenumber);
      if (pos !== -1) {
        this.tiles.splice(pos, 1);
      } else {
        console.log(`${this.tiles} does not contain ${tilenumber}?`);
      }
    }
    this.currentDiscard = { id, seat, tilenumber };
  }

  async "game:playerTookBack"({ id, seat, tilenumber }) {
    this.currentDiscard = false;
    if (this.id === id) {
      this.tiles.push(tilenumber);
      this.tiles.sort(sortTiles);
    }
  }

  async "game:playerPassed"({ id, seat }) {
    // useful to human players, not very relevant to bots
  }

  async "game:claimAwarded"(claim) {
    this.setSeat(claim.seat);
    if (claim.id === this.id) this.lock(claim);
    else {
      let player = this.players[claim.seat];
      if (!player.locked) player.locked = [];
      player.locked.push(claim);
    }
  }

  lock({ tilenumber, claimtype, wintype }) {
    if (claimtype === "win") {
      claimtype = wintype;
    }

    let set,
      t = tilenumber;

    if (claimtype === "pair") set = [t];
    if (claimtype === "chow1") set = [t + 1, t + 2];
    if (claimtype === "chow2") set = [t - 1, t + 1];
    if (claimtype === "chow3") set = [t - 2, t - 1];
    if (claimtype === "pung") set = [t, t];
    if (claimtype === "kong") set = [t, t, t];

    set.forEach(t => {
      let pos = this.tiles.indexOf(t);
      this.tiles.splice(pos, 1);
    });

    set.push(t);

    this.locked.push(set.sort(sortTiles));
  }

  async "game:playerWon"(winner) {
    this.winner = winner;
  }
};
