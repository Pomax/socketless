const lockTiles = require("../utils/lock-tiles.js");

const uuid = (function() {
  let clientIdCounter = 0;
  return () => clientIdCounter++;
})();

class User {
  constructor(client) {
    this.id = uuid();
    this.client = client;
    this.tiles = [];
    this.locked = [];
    this.bonus = [];
  }

  register() {
    this.client.admin.register(this.id);
  }

  setName(name) {
    this.name = name;
  }

  setGame(game) {
    this.game = game;
  }

  userJoined(user) {
    this.client.user.joined(user.id);
  }

  userChangedName(id, name) {
    this.client.user.changedName({ id, name });
  }

  userLeft(user) {
    this.client.user.left(user.id);
  }

  setGame(game) {
    this.game = game;
  }

  getDetails() {
    return {
      id: this.id,
      name: this.name,
      seat: this.seat,
      wind: this.wind
    };
  }

  gameCreated(creatorId, gameName) {
    this.client.game.created({
      id: creatorId,
      name: gameName
    });
  }

  startGame(details) {
    this.client.game.start(details);
  }

  updateGame(details) {
    this.client.game.updated(details);
  }

  assignSeat(seat, wind) {
    this.seat = seat;
    this.wind = wind;
    this.client.game.assignSeat({ seat, wind });
  }

  setTiles(tiles) {
    this.tiles = tiles;
    this.client.game.initialDeal(tiles);
  }

  hasTile(tilenumber) {
    return this.tiles.indexOf(tilenumber) > -1;
  }

  setCurrentPlayer(seat) {
    this.client.game.setCurrentPlayer(seat);
  }

  draw(tilenumber) {
    this.tiles.push(tilenumber);
    this.client.game.draw(tilenumber);
  }

  compensate(tilenumber) {
    this.tiles.push(tilenumber);
    this.client.game.compensate(tilenumber);
  }

  seeBonus(player, tilenumber) {
    if (player === this) {
      this.bonus.push(tilenumber);
      let pos = this.tiles.indexOf(tilenumber);
      this.tiles.splice(pos, 1);
    }

    this.client.game.playerDeclaredBonus({
      id: player.id,
      seat: player.seat,
      tilenumber: tilenumber
    });
  }

  seeDiscard(player, tilenumber, timeout) {
    if (player === this) {
      let pos = this.tiles.indexOf(tilenumber);
      this.tiles.splice(pos, 1);
    }

    this.client.game.playerDiscarded({
      gameName: this.game.name,
      id: player.id,
      seat: player.seat,
      tilenumber,
      timeout
    });
  }

  undoDiscard(player, tilenumber) {
    if (player === this) {
      this.tiles.push(tilenumber);
    }

    this.client.game.playerTookBack({
      id: player.id,
      seat: player.seat,
      tilenumber
    });
  }

  passed(player) {
    this.client.game.playerPassed({
      id: player.id,
      seat: player.seat
    });
  }

  claimAwarded(award) {
    if (award.id === this.id) lockTiles(this.tiles, this.locked, award);
    this.client.game.claimAwarded(award);
  }

  handWon(id, seat, details) {
    this.client.game.playerWon({ id, seat });
    this.client.game.updated(details);
  }

  gameEnded() {
    this.client.game.ended({
      name: this.game.name
    });
  }

  leftGame(player) {
    this.client.game.left({
      seat: player.seat
    });
  }
}

module.exports = User;
