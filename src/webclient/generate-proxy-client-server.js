/**
 * TARGET:BROWSER
 *
 * This function is converted to a string, wholesale, and
 * sent over to the browser, where it will be executed.
 *
 * This code does _not_ run anywhere except in the browser,
 * as part of a webclient `createClientServer()` call.
 */
export function generateProxyClientServer(WebClientClass, directSync) {
  const url = window.location.toString().replace("http", "ws");
  const socketToClient = new WebSocket(url);

  // @ts-ignore: upgradeSocket is a global when this file runs in the browser
  const socket = upgradeSocket(socketToClient);
  const proxyServer = {};

  // Create a client instances
  const webclient = new WebClientClass();
  webclient.server = proxyServer;
  if (!directSync) {
    Object.defineProperty(webclient, `state`, {
      writable: false,
      value: {},
    });
  }

  const update_target = directSync ? webclient : webclient.state;

  // Add the browser => client => server forwarding.
  // @ts-ignore: "namespaces" exists as global in the browser
  namespaces.forEach((namespace) => {
    proxyServer[namespace] = {};
    // @ts-ignore: "API" exists as global in the browser
    API[namespace].server.forEach((fname) => {
      let evt = namespace + ":" + fname;
      proxyServer[namespace][fname] = async function (data) {
        return await socket.upgraded.send(evt, data);
      };
    });
  });

  // TODO: make this an optional parameter similar to directSync
  const noGlobalEvent = false;

  // bind all new state values
  function updateState(newstate) {
    // Generate a global update event for this webclient
    if (!noGlobalEvent) {
      document.dispatchEvent(
        new CustomEvent("webclient:update", {
          detail: {
            update: newstate,
          },
        }),
      );
    }

    // call setState, if it exists, otherwise just perform the updates
    if (webclient.setState) {
      webclient.setState(newstate);
    } else {
      Object.keys(newstate).forEach(
        (key) => (update_target[key] = newstate[key]),
      );
    }

    // call the update function, if it exists.
    if (webclient.update) {
      webclient.update(update_target);
    }
  }

  // turn a state diff into a state update
  async function handleStateDiff(patch) {
    if (patch.length === 0) return;

    // verify we're still in sync by comparing messaging sequence numbers
    const seq_num = patch.slice(-1)[0].value;
    if (seq_num === update_target.__seq_num + 1) {
      // @ts-ignore: "rfc6902" exists as global in the browser
      rfc6902.applyPatch(update_target, patch); // Note: this call updates in-place
      return updateState(update_target);
    }

    // if we get here, wee're not in sync and need to request a full
    // state object instead of trying to apply differential states.
    const state = await socket.upgraded.send(`sync:full`, {
      last_seq_num: update_target.__seq_num,
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

  socket.upgraded.on(`keepalive`, (_, respond) => {
    respond(`acknowledged`);
  });

  // and offer a sync() function to manually trigger a full bootstrap
  webclient.sync = async () => {
    updateState(await socket.upgraded.send(`sync:full`));
  };

  // Then: add the server => client => browser forwarding
  // @ts-ignore: "namespaces" exists as global in the browser
  namespaces.forEach((namespace) => {
    // @ts-ignore: "API" exists as global in the browser
    API[namespace].client.forEach((fname) => {
      let evt = namespace + ":" + fname;
      let process = webclient[evt];
      if (!process) process = webclient[evt.replace(":", "$")];

      // Web clients need not implement the full interface, as some
      // things don't need to be handled by the browser at all.
      if (process) {
        socket.upgraded.on(evt, async (data, respond) => {
          let response = await process.bind(webclient)(data);
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
  webclient.quit = () => socket.upgraded.send("quit", {});

  // And we're done building this object
  return {
    client: webclient,
    server: proxyServer,
  };
}
