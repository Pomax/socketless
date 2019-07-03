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
  }

  addPlayer(player) {
    if (this.players.indexOf(player) > -1) return true;
    this.players.push(player);
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
      players: this.players.map(player => player.id)
    };
  }

  async start() {
    let details = this.getDetails();
    this.players.forEach(player => player.client.game.start(details));
    this.inProgress = true;

    // the game loop on the players' side is "draw one, play one",
    // which translates to a server loop of "deal one, receive one".

    this.setupWall();
    this.assignSeats();
    this.dealInitial();

    this.currentWind = 0;
    this.windOfTheRound = 0;
    this.currentPlayer = 0;

    this.dealTile();
  }

  setupWall() {
    this.wall = new Wall();
  }

  assignSeats() {
    this.players.forEach((player, position) =>
      player.client.game.setWind({
        seat: position,
        wind: [`東`, `北`, `西`, `北`][position]
      })
    );
  }

  dealInitial() {
    this.players.forEach(player => {
      let tiles = this.wall.get(13);
      player.client.game.initialDeal(tiles);
    });
  }

  dealTile() {
    let tilenumber = this.wall.get();
    this.players.forEach((player,seat) => {
      player.client.game.setCurrentPlayer(this.currentPlayer);
      if (seat === this.currentPlayer) player.client.game.draw(tilenumber);
    });
  }

  playerDiscarded(player, tilenumber) {
    if (player.id !== this.currentPlayer) return;

    // inform all clients of this discard
    this.players.forEach(p =>
      p.client.game.playerDiscarded({
        gameName: this.name,
        id: player.id,
        tilenumber,
        timeout: 5000
      })
    );

    // start a claim timer. When it expires,
    // move to the next player if no claims
    // have been made. Otherwise, honour the
    // highest ranking claim.
    this.claims = [];
    this.claimTimer = setTimeout(() => {
      if (this.claims.length) {
        // award claim
        let claim = this.claims[0];
        claim.player.client.game.awardClaim({
          claimtype: claim.type,
          tilenumber
        });
      } else {
        // move to next player
        this.currentPlayer = (this.currentPlayer + 1) % this.players.length;
        this.dealTile();
      }
    }, 5000);
  }
};
