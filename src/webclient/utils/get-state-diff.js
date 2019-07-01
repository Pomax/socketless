const { createPatch } = require('rfc6902');

module.exports = function getStateDiff(newState, oldState) {
  return createPatch(oldState, newState);
};
