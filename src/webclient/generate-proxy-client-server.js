/**
 * TARGET:BROWSER
 *
 * This function is converted to a string, wholesale, and
 * sent over to the browser, where it will be executed.
 *
 * This code does _not_ run anywhere except in the browser,
 * as part of a webclient `createClientServer()` call.
 */
function generateClientServer(WebClientClass, directSync) {
  const url = window.location.toString().replace("http", "ws");
  const socketToClient = new WebSocket(url);
  const socket = upgradeSocket(socketToClient);
  const proxyServer = {};

  // Create a client instances
  const handler = new WebClientClass();
  handler.server = proxyServer;
  if (!directSync) {
    handler.state = {'test': true};
  }

  const update_target = directSync ? handler : handler.state;

  let __seq_num = 0;

  // Add the browser => client => server forwarding
  namespaces.forEach(namespace => {
    proxyServer[namespace] = {};
    API[namespace].server.forEach(fname => {
      let evt = namespace + ":" + fname;
      proxyServer[namespace][fname] = async function(data) {
        return await socket.upgraded.send(evt, data);
      };
    });
  });

  // bind all new state values
  function updateState(newstate) {
    if (handler.setState) handler.setState(newstate);
    else Object.keys(newstate).forEach(key => (update_target[key] = newstate[key]));
    if (handler.update) handler.update(update_target);
  }

  // turn a state diff into a state update
  async function handleStateDiff(patch) {
    if (patch.length === 0) return;

    // verify we're still in sync by comparing messaging sequence numbers
    const seqnum = patch.slice(-1)[0].value;
    if (seqnum === __seq_num + 1) {
      const state = jsonpatch.apply_patch(update_target, patch);
      return updateState(state);
    }

    // if we get here, wee're not in sync and need to request a full
    // state object instead of trying to apply differential states.
    const state = await socket.upgraded.send(`sync:full`, {
      last_seq_num: __seq_num
    });

    updateState(state);
  }

  // ensure that bootstrap instructions are processed
  socket.upgraded.on(`sync`, (diff, respond) => {
    handleStateDiff(diff);
    respond();
  });

  socket.upgraded.on(`sync:full`, (state, respond) => {
    updateState(state);
    respond();
  });

  // and offer a sync() function to manually trigger a full bootstrap
  handler.sync = async () => {
    updateState(await socket.upgraded.send(`sync:full`));
  }

  // Then: add the server => client => browser forwarding
  namespaces.forEach(namespace => {
    API[namespace].client.forEach(fname => {
      let evt = namespace + ":" + fname;
      let process = handler[evt];
      if (!process) process = handler[evt.replace(":", "$")];

      // Web clients need not implement the full interface, as some
      // things don't need to be handled by the browser at all.
      if (process) {
        socket.upgraded.on(evt, async (data, respond) => {
          let response = await process.bind(handler)(data);
          respond(response);
        });
      }

      // If they don't, signal an undefined response, mostly to
      // make sure that the response listener gets cleaned up
      // immediately on the true client's side.
      else socket.upgraded.on(evt, async (_data, respond) => respond());
    });
  });

  // Add a dedicated .quit() function so browsers can effect a disconnect
  proxyServer.quit = () => socket.upgraded.send("quit", {});

  // And we're done building this object
  return {
    client: handler,
    server: proxyServer
  };
}

module.exports = generateClientServer;
