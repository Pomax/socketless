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

  getDetails() {
    return {
      id: this.owner.id,
      name: this.name,
      players: this.players.map(player => player.id)
    };
  }

  start() {
    let details = this.getDetails();
    this.players.forEach(player => player.client.game.start(details));
    this.inProgress = true;
  }
};
