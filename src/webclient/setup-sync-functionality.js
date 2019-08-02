const getStateDiff = require("./utils/get-state-diff.js");

/**
 * NOTE: this code currently does not verify that a sync instruction
 * was actually handled, and so it is possible for `prev` to get updated
 */
module.exports = function setupSyncFunctionality(
  sockets,
  socket,
  direct = false // pull straight from the client instance, rather than client.state
) {
  // sync lock mechanism
  let syncing = false;
  let lastsync = false;

  let prevState = {};
  let prevSeqNum = 0;
  const getNextSeqNum = () => prevSeqNum++;

  const getState = () => {
    return direct
      ? JSON.parse(JSON.stringify(sockets.client))
      : sockets.client.state;
  };

  /**
   * The state update function returns a diff between the current
   * state and the previous state. This function should only ever
   * be called in response to sync() calls.
   */
  const getStateUpdate = () => {
    const state = getState();
    const diff = getStateDiff(state, prevState);
    if (diff.length) {
      prevState = JSON.parse(JSON.stringify(state));
      diff.push({ op: "replace", path: "/__seq_num", value: getNextSeqNum() });
    }
    return diff;
  };

  // differential sync request handler for browser sync request
  socket.upgraded.on(`sync`, (_data, respond) => respond(getStateUpdate()));

  /**
   * The full state function returns the entire state rather than a
   * differential state, pegged to the current sequence number.
   * This is used for initial bootstrap, as well as any time the
   * browser "desyncs" from the client (which it detects by seeing
   * a differential sequence number that does not match what it
   * knows the next sequence number should be).
   */
  const getFullState = () => {
    const state = getState();
    prevState = JSON.parse(JSON.stringify(state));
    state.__seq_num = getNextSeqNum();
    return state;
  };

  // full sync request handler for browser sync request
  socket.upgraded.on(`sync:full`, (_data, respond) => respond(getFullState()));

  // bind sync functions so that we use them during call routing
  socket.fullsync = () => socket.upgraded.send(`sync:full`, getFullState());
  socket.sync = async () => {
    if (syncing) return (lastsync = true);
    let update = getStateUpdate();
    if (update.length) {
      syncing = true;
      await socket.upgraded.send(`sync`, update);
      syncing = false;
      if (lastsync) {
        lastsync = false;
        socket.sync();
      }
    }
  };

  // and send an initial full sync instruction to the browser
  socket.fullsync();
};
