const Wall = require("./wall.js");
const CLAIM_TIMEOUT = 10000;
const generateRandomName = require("../utils/name-generator.js");

module.exports = class Game {
  constructor(owner) {
    this.name = generateRandomName();
    this.owner = owner;
    this.players = [owner];
    // TODO: track who has which tile in hand, because claims should be verifiable
    this.inProgress = false;
    owner.game = this;
  }

  addPlayer(player) {
    if (this.players.indexOf(player) > -1) return true;
    this.players.push(player);
    player.game = this;
  }

  leave(player) {
    let pos = this.players.indexOf(player);
    if (pos > -1) {
      this.players.forEach(p => p.client.game.left({ seat: player.seat }));
      this.players.splice(pos, 1);
    }
  }

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

  setupWall() {
    this.wall = new Wall();
  }

  assignSeats() {
    this.players.forEach((player, position) => {
      player.seat = position;
      player.wind = [`東`, `南`, `西`, `北`][position];
      player.client.game.setWind({
        seat: player.seat,
        wind: player.wind
      });
    });
  }

  dealInitialTiles() {
    this.players.forEach(player => {
      let tiles = this.wall.get(13);
      player.client.game.initialDeal(tiles);
    });
  }

  dealTile() {
    this.currentDiscard = false;
    let tilenumber = this.wall.get();
    this.players.forEach((player, seat) => {
      player.client.game.setCurrentPlayer(this.currentPlayer);
      if (seat === this.currentPlayer) player.client.game.draw(tilenumber);
    });
  }

  nextPlayer() {
    this.currentPlayer = (this.currentPlayer + 1) % this.players.length;
    this.dealTile();
  }

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

  playerClaim(player, claimtype, wintype) {
    this.claims.push({ player, claimtype, wintype });
    if (this.claims.length + this.passes.length === this.players.length - 1) {
      this.handleClaims();
    }
  }

  handleClaims() {
    clearTimeout(this.claimTimer);

    if (!this.claims.length) {
      return this.nextPlayer();
    }

    let claim = this.claims[0];
    let award = {
      tilenumber: this.currentDiscard,
      id: claim.player.id,
      seat: claim.player.seat,
      claimtype: claim.claimtype,
      wintype: claim.wintype
    };
    this.currentDiscard = false;
    this.players.forEach(player => player.client.game.claimAwarded(award));
    this.currentPlayer = claim.player.seat;

    if (claim.claimtype === `win`) {
      this.declareWin(award);
    }
  }

  declareWin({ id, seat }) {
    this.finished = true;
    this.players.forEach(player => {
      player.client.game.playerWon({ id, seat });
      player.client.game.updated(this.getDetails());
    });
  }
};
