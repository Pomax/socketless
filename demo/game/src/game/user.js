const lockTiles = require("../utils/lock-tiles.js");

const uuid = (function() {
  let clientIdCounter = 0;
  return () => clientIdCounter++;
})();

/**
 * In order to prevent cheating, the game server needs to
 * have a local representation of a player, through which
 * to track tiles, locked sets, and bonus tiles.
 *
 * We can combine this with the general concept of a user
 * object (with a user id, name, etc), and use this User
 * class as both a server user and game player.
 */
class User {
  constructor(client) {
    this.id = uuid();
    this.client = client;
    this.tiles = [];
    this.locked = [];
    this.bonus = [];
  }

  // register this user's id
  register() {
    this.client.admin.register(this.id);
  }

  // set this user's name (bind only)
  setName(name) {
    this.name = name;
  }

  // set this user's game (bind only)
  setGame(game) {
    this.game = game;
  }

  // notify this user's client that someone joined
  userJoined(user) {
    this.client.user.joined(user.id);
  }

  // notify this user's client that someone changed their name
  userChangedName(id, name) {
    this.client.user.changedName({ id, name });
  }

  // notify this user's client that someone left
  userLeft(user) {
    this.client.user.left(user.id);
  }

  // Get a summary of this user that can be set to other players
  getDetails() {
    return {
      id: this.id,
      name: this.name,
      seat: this.seat,
      wind: this.wind
    };
  }

  // notify this user's client that a game was created
  gameCreated(creatorId, gameName) {
    this.client.game.created({
      id: creatorId,
      name: gameName
    });
  }

  // notify this user's client that a game started
  startGame(details) {
    this.client.game.start(details);
  }

  // notify this user's client that a game state was updated
  updateGame(details) {
    this.client.game.updated(details);
  }

  // notify this user's client that seat assignment occurred
  assignSeat(seat, wind) {
    this.seat = seat;
    this.wind = wind;
    this.client.game.assignSeat({ seat, wind });
  }

  // notify this user's client of their initial tiles
  setTiles(tiles) {
    this.tiles = tiles;
    this.client.game.initialDeal(tiles);
  }

  // helper function to verify a user has a specific tile in hand
  hasTile(tilenumber) {
    return this.tiles.indexOf(tilenumber) > -1;
  }

  // notify this user's client who the current player is
  setCurrentPlayer(seat) {
    this.client.game.setCurrentPlayer(seat);
  }

  // notify this user's client that they drew a tile
  draw(tilenumber) {
    this.tiles.push(tilenumber);
    this.client.game.draw(tilenumber);
  }

  // notify this user's client that they drew a supplement tile
  supplement(tilenumber) {
    this.tiles.push(tilenumber);
    this.client.game.supplement(tilenumber);
  }

  // notify this user's client that someone had a bonus tile
  seeBonus(player, tilenumber) {
    if (player === this) {
      // if this is our own bonus tile, we need to make sure it
      // gets moved out of the tiles list, and into the bonus list.
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

  // notify this user's client that a discard occurred
  seeDiscard(player, tilenumber, timeout) {
    if (player === this) {
      // if this is our tile, make sure to remove it from the tiles list
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

  // notify this user's client that a discard was taken back
  undoDiscard(player, tilenumber) {
    if (player === this) {
      // if this is our tile, make sure to put it back into tiles list
      this.tiles.push(tilenumber);
    }

    this.client.game.playerTookBack({
      id: player.id,
      seat: player.seat,
      tilenumber
    });
  }

  // notify this user's client that a player passed on the discard
  passed(player) {
    this.client.game.playerPassed({
      id: player.id,
      seat: player.seat
    });
  }

  // notify this user's client that a claim was awarded
  claimAwarded(award) {
    if (award.id === this.id) lockTiles(this.tiles, this.locked, award);
    this.client.game.claimAwarded(award);
  }

  // notify this user's client that a player won this hand
  handWon(id, seat, details) {
    this.client.game.playerWon({ id, seat });
    this.client.game.updated(details);
  }

  // notify this user's client that the game is over
  gameEnded() {
    this.client.game.ended({
      name: this.game.name
    });
  }

  // notify this user's client that a player left this game
  leftGame(player) {
    this.client.game.left({
      seat: player.seat
    });
  }
}

module.exports = User;
