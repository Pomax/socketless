const lockTiles = require("../utils/lock-tiles.js");
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
   * When the web client quits, this function automatically
   * gets called by the socketless framework. Since we're running
   * clients as their own process: kill that process.
   */
  onQuit() {
    console.log("Shutting down client.");
    process.exit(0);
  }

  /**
   * When the server registers us, set our state to
   * include our assigned id, and the list of other
   * known users, and extant games.
   */
  async "admin:register"(id) {
    this.setState({
      id: id,
      users: await this.server.user.getUserList(),
      games: await this.server.game.getGameList()
    });
  }

  /**
   * When we receive a chat message, queue it.
   */
  async "chat:message"({ id, message }) {
    this.state.chat.push({ id, message });
  }

  /**
   * When a user joined, create a user record in our
   * list of known users.
   */
  async "user:joined"(id) {
    let user = this.state.users.find(u => u.id === id);
    if (!user) {
      this.state.users.push({ id });
    }
  }

  /**
   * When a user leaves, remove them from that list.
   */
  async "user:left"(id) {
    let pos = this.state.users.findIndex(u => u.id === id);
    if (pos > -1) this.state.users.splice(pos, 1);
  }

  /**
   * When a user changes name, record that.
   */
  async "user:changedName"({ id, name }) {
    let user = this.state.users.find(u => u.id === id);
    if (user) user.name = name;
  }

  /**
   * When someone creates a game, add a new game entry
   * to our list of known games.
   */
  async "game:created"({ id, name }) {
    this.state.games.push({ id, name, players: [{ id }] });
  }

  /**
   * When a game is updated for whatever reason, mirror
   * that update locally.
   */
  async "game:updated"(details) {
    let pos = this.state.games.findIndex(g => g.name === details.name);
    if (pos > -1) this.state.games[pos] = details;
  }

  /**
   * When a game we are joined into starts, make sure to
   * allocate all the relevant variables that we're going
   * to make use of, so that the web client can start
   * working with those.
   */
  async "game:start"({ name, players }) {
    // This represents our knowledge of "which tiles
    // might still exist in the game".
    const allTiles = {};
    for (let i = 0; i < 34; i++) allTiles[i] = 4;
    this.setState({
      currentGame: name,
      players: players,
      tiles: [],
      bonus: [],
      locked: [],
      winner: false,
      currentDiscard: false,
      wall: allTiles
    });

    this.state.games.find(g => g.name === name).inProgress = true;

    return { ready: true };
  }

  /**
   * When a game is over, remove it from our list of known games.
   */
  async "game:ended"({ name }) {
    let pos = this.state.games.findIndex(g => g.name === name);
    this.state.games.splice(pos, 1);
  }

  /**
   * Set our wind and seat for the game we're in.
   */
  async "game:assignSeat"({ seat, wind }) {
    this.setState({
      seat: seat,
      wind: wind
    });
  }

  // helper functions to update what we know about the wall,
  // as we see tiles come into our hand and getting played.
  seeTile(tilenumber) {
    this.state.wall[tilenumber]--;
  }
  seeTiles(tilenumbers) {
    if (!tilenumbers.forEach) tilenumbers = [tilenumbers];
    tilenumbers.forEach(tilenumber => this.state.wall[tilenumber]--);
  }
  unseeTile(tilenumber) {
    this.state.wall[tilenumber]++;
  }
  unseeTiles(tilenumbers) {
    if (!tilenumbers.forEach) tilenumbers = [tilenumbers];
    tilenumbers.forEach(tilenumber => this.state.wall[tilenumber]++);
  }

  /**
   * Set our initial tiles, so we can start playing.
   */
  async "game:initialDeal"(tiles) {
    tiles.sort(sortTiles);
    this.state.bonus = tiles.filter(t => t >= 34);
    this.state.tiles = tiles.filter(t => t <= 33);
    this.state.bonus.forEach(tilenumber =>
      this.server.game.bonusTile({ tilenumber })
    );
    this.seeTiles(this.state.tiles);
  }

  /**
   * Take note of the fact that someone declared drawing
   * a bonus tile, rather than a normal play tile.
   */
  async "game:playerDeclaredBonus"({ id, seat, tilenumber }) {
    let player = this.state.players[seat];
    if (!player.bonus) player.bonus = [];
    player.bonus.push(tilenumber);
    player.bonus.sort(sortTiles);
  }

  // Helper function to make sure only play tiles make it
  // into the tiles list. Bonus tiles are immediately moved
  // into the bonus list, with a notification to the server
  // that a bonus tile was locked away.
  acceptTile(tilenumber) {
    if (tilenumber >= 34) {
      this.state.bonus.push(tilenumber);
      this.state.bonus.sort(sortTiles);
      this.server.game.bonusTile({ tilenumber });
      return false;
    }

    let tiles = this.state.tiles;
    tiles.push(tilenumber);
    tiles.sort(sortTiles);
    if (this.state.seat === this.state.currentPlayer) {
      this.state.latestTile = tilenumber;
    }

    this.seeTile(tilenumber);
  }

  /**
   * This function is called by the server rather than use
   * calling it: we have been dealt a tile, so add it to
   * our hand, or our bonus pile, depending on what it was.
   */
  async "game:draw"(tilenumber) {
    this.acceptTile(tilenumber);
  }

  /**
   * When locking away bonus tiles or kongs, the player is
   * awarded a compensation tile, to ensure that they still
   * have enough tiles to form a winning pattern with.
   *
   * While the result is the same as game:draw, most rules
   * have special scoring when winning uses a compensation
   * tile.
   */
  async "game:supplement"(tilenumber) {
    this.acceptTile(tilenumber);
    this.state.supplementTile = true;
  }

  /**
   * helper function to take note of the current seat/player.
   */
  setSeat(seat) {
    this.setState({
      latestTile: false,
      supplementTile: false,
      currentDiscard: false,
      currentPlayer: seat,
      passed: false
    });
  }

  /**
   * Take note of which seat is the current player.
   */
  async "game:setCurrentPlayer"(seat) {
    this.setSeat(seat);
  }

  /**
   * Someone discarded a tile!
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
    } else {
      this.seeTile(tilenumber);
    }
    this.state.currentDiscard = { id, seat, tilenumber };
  }

  /**
   * Someone took back their tile...
   */
  async "game:playerTookBack"({ id, seat, tilenumber }) {
    this.state.currentDiscard = false;
    if (id === this.state.id) {
      let tiles = this.state.tiles;
      tiles.push(tilenumber);
      tiles.sort(sortTiles);
    } else {
      this.unseeTile(tilenumber);
    }
  }

  /**
   * Someone passed on claiming the current discard.
   */
  async "game:playerPassed"({ id, seat }) {
    if (id === this.state.id) {
      this.state.passed = true;
    }
  }

  /**
   * Someone's claim on the current discard went through.
   */
  async "game:claimAwarded"(claim) {
    this.setSeat(claim.seat);
    if (claim.id === this.state.id)
      lockTiles(this.state.tiles, this.state.locked, claim);
    else {
      let player = this.state.players[claim.seat];
      if (!player.locked) player.locked = [];
      player.locked.push(claim);
      // TODO: see all tiles in this claim
    }
  }

  /**
   * Someone won!
   */
  async "game:playerWon"(winner) {
    this.state.winner = winner;
    this.state.wall = false;
    this.server.broadcast(this["game:reveal"], {
      seat: this.state.seat,
      tiles: this.state.tiles
    });
  }

  /**
   * A player revealed all their tiles. This usually only
   * happens at the end of the game, to see how close everyone
   * was (or not!) to winning.
   */
  async "game:reveal"({ seat, tiles }) {
    let player = this.state.players.find(p => p.seat === seat);
    if (player) player.tiles = tiles;
  }

  /**
   * Someone left the current game.
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
