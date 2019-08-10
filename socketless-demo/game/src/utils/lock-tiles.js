/**
 * Lock away a collection of tiles based on the game
 * server permitting our claim.
 */
module.exports = function lock(
  tiles,
  locked,
  { tilenumber, claimtype, wintype }
) {
  if (claimtype === "win") claimtype = wintype;

  let set,
    t = tilenumber,
    c = claimtype;

  if (c === "pair") set = [t];
  if (c === "chow1") set = [t + 1, t + 2];
  if (c === "chow2") set = [t - 1, t + 1];
  if (c === "chow3") set = [t - 2, t - 1];
  if (c === "pung") set = [t, t];
  if (c === "kong") set = [t, t, t];

  set.forEach(t => {
    let pos = tiles.indexOf(t);
    tiles.splice(pos, 1);
  });

  set.push(t);

  locked.push(set.sort((a, b) => a - b));
};
