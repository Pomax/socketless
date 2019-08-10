const Wall = require("./wall.js");

const CLAIM_TIMEOUT = 10000;

const CLAIM_VALUES = {
  pair: 1,
  chow1: 1,
  chow2: 1,
  chow3: 1,
  pung: 2,
  kong: 2,
  win: 3
};

const generateRandomName = require("../utils/name-generator.js");

/**
 * This class models a game of Mahjong - in a fairly naive way
 * in that it's only a single round. However, all the core
 * game mechanics should be here.
 */
module.exports = class Game {
  constructor(owner) {
    this.name = generateRandomName();
    this.owner = owner;
    this.owner.setGame(this);
    this.inProgress = false;
    this.players = [this.owner];
  }

  /**
   * Add a player to this game.
   */
  addPlayer(player) {
    if (this.players.find(p => p.id === player.id)) return true;
    player.setGame(this);
    this.players.push(player);
  }

  /**
   * Remove a player from this game, and notify all others.
   */
  leave(player) {
    this.players.forEach(p => p.leftGame(player));
    let pos = this.players.findIndex(p => p.id === player.id);
    if (pos > -1) this.players.splice(pos, 1);
  }

  /**
   * Get a summary of this game that can safely be
   * communicated to all players. So not things like
   * "which tiles are in each player's hand"!
   */
  getDetails() {
    return {
      id: this.owner.id,
      name: this.name,
      players: this.players.map(p => p.getDetails()),
      inProgress: this.inProgress,
      finished: this.finished
    };
  }

  /**
   *  Start a game!
   */
  async start() {
    this.inProgress = true;
    this.setupWall();
    this.assignSeats();
    let details = this.getDetails();
    this.players.forEach(p => p.startGame(details));
    this.currentWind = 0;
    this.windOfTheRound = 0;
    this.currentPlayer = 0;
    this.dealInitialTiles();
    // the game loop on the players' side is "draw one, play one",
    // which translates to a server loop of "deal one, receive one".
    this.dealTile();
  }

  /**
   * Set up a shuffled 144 tile wall.
   */
  setupWall() {
    this.wall = new Wall();
  }

  // A helper function to determine "roles" when playing.
  getWinds() {
    const len = this.players.length;
    // there is technically no rule that says you HAVE to
    // have four players, so we allow anywhere from 2 to 5.
    if (len === 2) return [`上`, `下`];
    if (len === 3) return [`発`, `中`, `白`];
    if (len === 4) return [`東`, `南`, `西`, `北`];
    if (len === 5) return [`火`, `水`, `木`, `金`, `土`];
    // with a silly last resort fallback. You can't even
    // deal tiles to all players with 8 people.
    return [`東`, `南`, `西`, `北`, `東`, `南`, `西`, `北`];
  }

  /**
   * Assign seats to all players
   */
  assignSeats() {
    this.players.forEach((player, seat) => {
      let wind = this.getWinds()[seat];
      player.assignSeat(seat, wind);
    });
  }

  /**
   * Deal each player their initial tiles.
   */
  dealInitialTiles() {
    this.players.forEach(player => {
      let tiles = this.wall.get(13);
      player.setTiles(tiles);
    });
  }

  /**
   * Deal a tile to the currently active player.
   */
  dealTile() {
    this.currentDiscard = false;
    let tilenumber = this.wall.get();
    this.players.forEach((player, seat) => {
      player.setCurrentPlayer(this.currentPlayer);
      if (seat === this.currentPlayer) player.draw(tilenumber);
    });
  }

  /**
   * Move play on to the next player.
   */
  nextPlayer() {
    this.currentPlayer = (this.currentPlayer + 1) % this.players.length;
    this.dealTile();
  }

  /**
   * Notify everyone that a player drew a bonus tile.
   */
  playerDeclaredBonus(player, tilenumber) {
    if (!player.hasTile(tilenumber)) return;
    this.players.forEach(p => p.seeBonus(player, tilenumber));
    player.supplement(this.wall.get());
  }

  /**
   * Notify everyone that a discard has occurred, and start
   * listening for claims that players may try to make for
   * the discarded tile.
   */
  playerDiscarded(player, tilenumber) {
    if (player.seat !== this.currentPlayer)
      return `out-of-turn discard attempt`;

    if (this.currentDiscard) return `another discard is already active`;

    if (!player.hasTile(tilenumber))
      return `player does not have this tile to discard`;

    this.currentDiscard = tilenumber;
    this.claims = [];
    this.passes = [];

    // inform all clients of this discard
    this.players.forEach(p => p.seeDiscard(player, tilenumber, CLAIM_TIMEOUT));

    // start a claim timer. When it expires,
    // move to the next player if no claims
    // have been made. Otherwise, honour the
    // highest ranking claim.
    this.claimTimer = setTimeout(() => this.handleClaims(), CLAIM_TIMEOUT);
  }

  /**
   * Check that a discard can be taken back, and either
   * allow that and notify all players, or disallow it
   * and notify the active player only.
   */
  undoDiscard(player) {
    if (player.seat !== this.currentPlayer) return `not discarding player`;

    if (this.claims.length) return `discard is already claimed`;

    clearTimeout(this.claimTimer);
    this.players.forEach(p => p.undoDiscard(player, this.currentDiscard));
    this.currentDiscard = false;
  }

  /**
   * Notify all players that a player passed on the current discard.
   */
  playerPasses(player) {
    if (this.passes.indexOf(player) === -1) {
      this.passes.push(player);
      this.players.forEach(p => p.passed(player));
      if (this.claims.length + this.passes.length === this.players.length - 1) {
        this.handleClaims();
      }
    }
  }

  /**
   * Receive a claim on the current discard from a player.
   */
  playerClaim(player, claimtype, wintype) {
    this.claims.push({ player, claimtype, wintype });
    if (this.claims.length + this.passes.length === this.players.length - 1) {
      this.handleClaims();
    }
  }

  /**
   * Process all received claims, awarding the highest "bidder".
   */
  handleClaims() {
    clearTimeout(this.claimTimer);

    // if there are no claims, just move on to the next player.
    if (!this.claims.length) {
      return this.nextPlayer();
    }

    // TODO: verify each claim is legal.
    this.claims.sort((a, b) => {
      return CLAIM_VALUES[b.claimtype] - CLAIM_VALUES[a.claimtype];
      // TODO: verify claims are legal
      // TODO: correctly resolve multiple win claims
    });

    const claim = this.claims[0];
    const award = {
      id: claim.player.id,
      seat: claim.player.seat,
      claimtype: claim.claimtype,
      wintype: claim.wintype,
      tilenumber: this.currentDiscard
    };

    this.currentDiscard = false;
    this.players.forEach(p => p.claimAwarded(award));
    this.currentPlayer = claim.player.seat;

    if (claim.claimtype === `kong`) {
      this.players[this.currentPlayer].supplement(this.wall.get());
    }

    if (claim.claimtype === `win`) {
      this.declareWin(award);
    }
  }

  /**
   * A player has won! Notify everyone.
   */
  declareWin({ id, seat }) {
    this.finished = true;
    let details = this.getDetails();
    this.players.forEach(p => p.handWon(id, seat, details));
  }
};
