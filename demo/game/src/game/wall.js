let Random = require("../utils/prng.js");

// Standard wall definition.
let base = [...new Array(34)].map((_, i) => i);
const BASE = base
  .concat(base)
  .concat(base)
  .concat(base)
  .concat([34, 35, 36, 37, 38, 39, 40, 41]);

/**
 * This basically represents a shuffled a pile of
 * tiles for dealing from during a hand of play.
 */
module.exports = class Wall {
  constructor() {
    this.reset();
  }

  /**
   *  shuffle utility function, also used by WallHack
   */
  shuffle(list) {
    list = list.slice();
    let shuffled = [];
    while (list.length) {
      let pos = (this.prng.nextFloat() * list.length) | 0;
      shuffled.push(list.splice(pos, 1)[0]);
    }
    return shuffled;
  }

  /**
   * Reset the wall to a full set of tiles, then shuffle them.
   */
  reset() {
    this.prng = new Random();
    this.tiles = this.shuffle(BASE.slice());
    this.deadSize = 16;
    this.dead = false;
    this.remaining = this.tiles.length - this.dead;
  }

  /**
   * Get one or more tiles from the wall.
   */
  get(n = 1) {
    let slice = this.tiles.splice(0, n);
    if (n === 1) return slice[0];
    return slice;
  }
};
