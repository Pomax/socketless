/**
 * TARGET:BROWSER
 *
 * This function is converted to a string, wholesale, and
 * sent over to the browser, where it will be executed.
 *
 * This code does _not_ run anywhere except in the browser,
 * as part of a webclient `createClientServer()` call.
 */
function generateClientServer(WebClientClass) {
  const socketToClient = exports.io(window.location.toString());
  const socket = upgradeSocket(socketToClient);
  const proxyServer = {};

  // Create a client instances
  const handler = new WebClientClass();
  handler.server = proxyServer;
  handler.__seq_num = 0;

  // Add the browser => client => server forwarding
  namespaces.forEach(namespace => {
    proxyServer[namespace] = {};
    API[namespace].server.forEach(fname => {
      let evt = namespace + ":" + fname;
      proxyServer[namespace][fname] = async function(data) {
        return await socket.emit(evt, data);
      };
    });
  });

  // bind all new state values
  function updateState(newstate) {
    if (handler.setState) handler.setState(newstate);
    else Object.keys(newstate).forEach(key => (handler[key] = newstate[key]));
    if (handler.update) handler.update();
  }

  // turn a state diff into a state update
  function handleStateDiff(patch) {
    const seqnum = patch.slice(-1)[0].value;
    if (seqnum === handler.__seq_num + 1) {
      const state = jsonpatch.apply_patch(handler, patch);
      return updateState(state);
    }

    // if we get here, wee're no longer in sync and need to
    // request a full state instead of a differential state.
    socket.emit(`sync:full`, { last_seq_num: handler.__seq_num });
  }

  // ensure that bootstrap instructions are processed
  socket.on(`sync`, diff => handleStateDiff(diff));
  socket.on(`sync:full`, state => updateState(state));

  // and offer a sync() function to manually trigger a bootstrap
  handler.sync = async () => handleStateDiff(await socket.emit(`sync`));

  // Then: add the server => client => browser forwarding
  namespaces.forEach(namespace => {
    API[namespace].client.forEach(fname => {
      let evt = namespace + ":" + fname;
      let process = handler[evt];
      if (!process) process = handler[evt.replace(":", "$")];

      // Web clients need not implement the full interface, as some
      // things don't need to be handled by the browser at all.
      if (process) {
        socket.on(evt, async (data, respond) => {
          let response = await process.bind(handler)(data);
          respond(response);
        });
      }

      // If they don't, signal an undefined response, mostly to
      // make sure that the response listener gets cleaned up
      // immediately on the true client's side, and request a
      // sync() to ensure the browser reflects the client.
      else {
        socket.on(evt, async (_data, respond) => {
          respond();
          handler.sync();
        });
      }
    });
  });

  // Add a dedicated .quit() function so browsers can effect a disconnect
  proxyServer.quit = () => socket.emit("quit", {});

  // And we're done building this object
  return {
    client: handler,
    server: proxyServer
  };
}

module.exports = generateClientServer;
