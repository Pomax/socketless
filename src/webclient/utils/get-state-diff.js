const { createPatch } = require("rfc6902");

module.exports = function getStateDiff(newState, oldState) {
  console.log(`GetStateDiff: ${JSON.stringify(oldState)} vs ${JSON.stringify(newState)}`)
  console.trace();
  return createPatch(oldState, newState);
};
