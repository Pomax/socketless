const getState = require("./utils/get-state.js");
const getStateDiff = require("./utils/get-state-diff.js");

/**
 * NOTE: this code currently does not verify that a sync instruction
 * was actually handled, and so it is possible for `prev` to get updated
 */
module.exports = function setupSyncFunctionality(sockets, socket) {
  const bypassTheseProperties = [
    "is_web_client",
    "browser_connected",
    "server"
  ];

  let prevState = {};
  let prevSeqNum = 0;
  const getNextSeqNum = () => prevSeqNum++;

  // get the current client state
  const getCurrentState = () => {
    return getState(sockets.client, bypassTheseProperties);
  };

  /**
   * The state update function returns a diff between the current
   * state and the previous state. This function should only ever
   * be called in response to sync() calls.
   */
  const getStateUpdate = () => {
    const state = getCurrentState();
    const diff = getStateDiff(state, prevState);
    prevState = JSON.parse(JSON.stringify(state));
    diff.push({ op: "replace", path: "/__seq_num", value: getNextSeqNum() });
    return diff;
  };

  // differential sync request handler for browser sync request
  socket.on(`sync`, (_data, respond) => respond(getStateUpdate()));

  /**
   * The full state function returns the entire state rather than a
   * differential state, pegged to the current sequence number.
   * This is used for initial bootstrap, as well as any time the
   * browser "desyncs" from the client (which it detects by seeing
   * a differential sequence number that does not match what it
   * knows the next sequence number should be).
   */
  const getFullState = () => {
    let state = getCurrentState();
    prevState = JSON.parse(JSON.stringify(state));
    state.__seq_num = getNextSeqNum();
    return state;
  };

  // full sync request handler for browser sync request
  socket.on(`sync:full`, (_data, respond) => respond(getFullState()));

  // send an initial full sync instruction
  socket.emit(`sync:full`, getFullState());
};
