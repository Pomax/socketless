/**
 * Generate the list of legal claims for a discard, given a set of tiles in hand
 */
function legalClaims(tilenumber, tiles, maychow, forwin) {
  const options = [];

  // convert tiles into tile counts
  const count = {};
  tiles.forEach(tile => {
    count[tile] = count[tile] || 0;
    count[tile]++;
  });

  // and then count how many of this exact tile we have
  const tc = count[tilenumber];

  // if we can form a pair: cool, but that's only legal for wins
  if (forwin && tc === 1) {
    options.push({ type: "pair", value: 0, length: 2, winonly: true });
  }

  // Can we form any chows?
  if (maychow || forwin) {
    const p2 = tilenumber - 2,
      p1 = tilenumber - 1,
      n1 = tilenumber + 1,
      n2 = tilenumber + 2;
    const suit = (tilenumber / 9) | 0;
    const samesuit = t => t < 27 && ((t / 9) | 0) === suit;

    if (count[p2] && samesuit(p2) && count[p1]) {
      options.push({ type: "chow3", value: 1, length: 3 });
    }

    if (count[p1] && samesuit(p1) && count[n1] && samesuit(n1)) {
      options.push({ type: "chow2", value: 1, length: 3 });
    }

    if (count[n2] && samesuit(n2) && count[n1]) {
      options.push({ type: "chow1", value: 1, length: 3 });
    }
  }

  // How about a pung?
  if (tc === 2) {
    options.push({ type: "pung", value: 2, length: 3 });
  }

  // Or maybe even a kong?
  if (!forwin && tc === 3) {
    options.push({ type: "kong", value: 2, length: 4 });
  }

  if (!forwin) {
    options.push({ type: "win", value: 3 });
  }

  return options;
}

// Make sure we can use this in node and browser context alike:
if (typeof module !== "undefined" && module.exports) {
  module.exports = legalClaims;
}
