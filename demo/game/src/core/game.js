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
    this.players = [owner];
    // TODO: track who has which tile sin hand, because claims should be verifiable
    this.inProgress = false;
    owner.game = this;
  }

  /**
   * Add a player to this game.
   */
  addPlayer(player) {
    if (this.players.indexOf(player) > -1) return true;
    this.players.push(player);
    player.game = this;
  }

  /**
   * Remove a player from this game, and notify all others.
   */
  leave(player) {
    let pos = this.players.indexOf(player);
    if (pos > -1) {
      this.players.splice(pos, 1);
    }
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
      players: this.players.map(player => {
        return {
          id: player.id,
          seat: player.seat,
          wind: player.wind
        };
      }),
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
    this.players.forEach(player => player.client.game.start(details));
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
    if (len === 2) return [`上`, `下`];
    if (len === 3) return [`発`, `中`, `白`];
    if (len === 4) return [`東`, `南`, `西`, `北`];
    if (len === 5) return [`火`, `水`, `木`, `金`, `土`];
    return [`東`, `南`, `西`, `北`];
  }

  /**
   * Assign seats to all players
   */
  assignSeats() {
    this.players.forEach((player, position) => {
      player.seat = position;
      player.wind = getWinds()[position];
      player.client.game.setWind({
        seat: player.seat,
        wind: player.wind
      });
    });
  }

  /**
   * Deal each player their initial tiles.
   */
  dealInitialTiles() {
    this.players.forEach(player => {
      let tiles = this.wall.get(13);
      player.client.game.initialDeal(tiles);
    });
  }

  /**
   * Deal a tile to the currently active player.
   */
  dealTile() {
    this.currentDiscard = false;
    let tilenumber = this.wall.get();
    this.players.forEach((player, seat) => {
      player.client.game.setCurrentPlayer(this.currentPlayer);
      if (seat === this.currentPlayer) player.client.game.draw(tilenumber);
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
    this.players.forEach(p =>
      p.client.game.playerDeclaredBonus({
        id: player.id,
        seat: player.seat,
        tilenumber: tilenumber
      })
    );
    player.client.game.draw(this.wall.get());
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

    this.currentDiscard = tilenumber;
    this.claims = [];
    this.passes = [];

    // inform all clients of this discard
    this.players.forEach(p =>
      p.client.game.playerDiscarded({
        gameName: this.name,
        id: player.id,
        seat: player.seat,
        tilenumber,
        timeout: CLAIM_TIMEOUT
      })
    );

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

    let undo = {
      id: player.id,
      seat: player.seat,
      tilenumber: this.currentDiscard
    };
    this.currentDiscard = false;
    this.players.forEach(p => p.client.game.playerTookBack(undo));
  }

  /**
   * Notify all players that a player passed on the current discard.
   */
  playerPasses(player) {
    if (this.passes.indexOf(player) === -1) {
      this.passes.push(player);
      this.players.forEach(p =>
        p.client.game.playerPassed({ id: player.id, seat: player.seat })
      );
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
      // TODO: multiple win resolution
    });

    const claim = this.claims[0];
    const award = {
      tilenumber: this.currentDiscard,
      id: claim.player.id,
      seat: claim.player.seat,
      claimtype: claim.claimtype,
      wintype: claim.wintype
    };

    this.currentDiscard = false;
    this.players.forEach(player => player.client.game.claimAwarded(award));
    this.currentPlayer = claim.player.seat;

    if (claim.claimtype === `kong`) {
      this.players[claim.seat].game.draw(this.wall.get());
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
    this.players.forEach(player => {
      player.client.game.playerWon({ id, seat });
      player.client.game.updated(this.getDetails());
    });
  }
};
