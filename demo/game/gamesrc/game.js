const Wall = require("./wall.js");

function generateRandomName() {
  let empty = new Array(10).fill(0);
  let chars = empty.map(v => String.fromCharCode(97 + 26 * Math.random()));
  return chars.join("");
}

module.exports = class Game {
  constructor(owner) {
    this.name = generateRandomName();
    this.owner = owner;
    this.players = [owner];
    this.inProgress = false;
    owner.game = this;
  }

  addPlayer(player) {
    if (this.players.indexOf(player) > -1) return true;
    this.players.push(player);
    player.game = this;
  }

  left(player) {
    // This gets call for any player that has quit the server,
    // and so may not result in any changes whatsoever.
    let pos = this.players.indexOf(player);
    if (pos > -1) this.players.splice(pos, 1);
  }

  getDetails() {
    return {
      id: this.owner.id,
      name: this.name,
      players: this.players.map(player => {
        return {
          id: player.id,
          seat: player.seat
        };
      })
    };
  }

  async start() {
    let details = this.getDetails();
    this.inProgress = true;

    // the game loop on the players' side is "draw one, play one",
    // which translates to a server loop of "deal one, receive one".

    this.setupWall();
    this.assignSeats();
    this.players.forEach(player => player.client.game.start(details));

    this.currentWind = 0;
    this.windOfTheRound = 0;
    this.currentPlayer = 0;
    this.dealInitialTiles();
    this.dealTile();
  }

  setupWall() {
    this.wall = new Wall();
  }

  assignSeats() {
    this.players.forEach((player, position) => {
      player.seat = position;
      player.wind = [`東`, `北`, `西`, `北`][position];
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
    if (player.seat !== this.currentPlayer) return;

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
        timeout: 5000
      })
    );

    // start a claim timer. When it expires,
    // move to the next player if no claims
    // have been made. Otherwise, honour the
    // highest ranking claim.
    this.claimTimer = setTimeout(() => this.handleClaims(), 5000);
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
    clearInterval(this.claimTimer);

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
    this.players.forEach(player => player.client.game.claimAwarded(award));
    this.currentPlayer = claim.player.seat;

    if (claim.claimtype === `win`) {
      this.players.forEach(player => {
        // declare winner
        player.client.game.playerWon({
          id: award.id,
          seat: award.seat
        });

        // unbind the game
        player.game = undefined;
      });

      this.finished = true;
    }
  }
};
