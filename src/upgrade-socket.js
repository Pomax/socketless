if (typeof process !== "undefined") {
  // We do not want Node to artificially limit us to 10 sockets
  process.setMaxListeners(0);
}

// special property for determining whether a socket was already upgraded by this code.
const upgradeLabel = `this socket has been upgraded by socketless/upgrade-socket.js`;

// Special event names that require lower-level handling than the message router.
const RESERVED = [`close`, `error`, `open`, `ping`, `pong`];
const BROWSER_RESERVED = [`onDisconnect`];

// responses should always be "the event name, with :response added"
const getResponseName = eventName => `${eventName}:response`;

/**
 * This function takes a standard websocket, and
 * makes it better by updating the  `on` and `send`
 * functions so that they can autorespond, and be
 * used with `await`, respectively. This means you
 * can write code like this:
 *
 *   let data = await socket.upgraded.send('get-me-stuff', input);
 *   handleResult(data);
 *
 * as well as this:
 *
 *   const handlerStuff = (input, respond) => {
 *     let output = formOutput(input);
 *     respond(output);
 *   };
 *
 *   socket.upgraded.on('get-me-stuff', handleStuff);
 *
 * with a corresponding off:
 *
 *   socket.upgraded.off('get-me-stuff', handleStuff);
 *
 * And that's just so much nicer than plain websockets.
 */
function upgradeSocket(socket) {
  // don't upgrade an already-upgraded socket
  if (socket[upgradeLabel]) return socket;

  socket.upgraded = {
    on: () => {},
    off: () => {},
    send: async () => {}
  };

  // top level message handlers
  const handlers = {};

  // top level message router specifically for the
  // message format used by the socketless code.
  const router = data => {
    if (data.srcElement) {
      // get data out of browser WebSocket
      data = data.data;
    }
    try {
      data = JSON.parse(data);
    } catch (e) {
      return console.error("Could not parse websocket data:", data);
    }

    const eventName = data.name;
    const payload = data.payload;

    // don't handle these at all.
    if (BROWSER_RESERVED.indexOf(eventName) > -1) {
      return console.warn(`ignoring browser ${eventName} event`);
    }

    if (!handlers[eventName]) {
      return console.error(`no handlers for ${eventName}`);
    }

    handlers[eventName].forEach(handler => {
      handler(payload, function respond(responseData) {
        socket.upgraded.send(getResponseName(eventName), responseData);
      });
    });
  };

  // bind the message handler/router
  if (socket.on) {
    socket.on(`message`, router);
  } else {
    socket.onmessage = router;
  }

  // and then redefine .on() so that it works like .addEventListener()/2.
  socket.upgraded.on = (eventName, handler) => {
    if (RESERVED.indexOf(eventName) > -1)
      return socket.addEventListener(eventName, handler);
    if (!handlers[eventName]) {
      handlers[eventName] = [];
    }
    handlers[eventName].push(handler);
  };

  // with a corresponding .off() function, that works like .removeEventListener()/2.
  socket.upgraded.off = (eventName, handler) => {
    if (RESERVED.indexOf(eventName) > -1)
      return socket.removeEventListener(eventName, handler);
    if (!handlers[eventName]) return;
    const pos = handlers[eventName].indexOf(handler);
    handlers[eventName].splice(pos, 1);
  };

  /**
   * Add a promise-based emit/receive to the socket,
   * so that server code can `await` the client's
   * response in an asynchronous fashion. Note that there
   * is an optional third argument `timeout` that can be
   * used to say how long the emit should wait before
   * deciding there is no response forthcoming and to clean
   * up the event listener for that response.
   */
  socket.upgraded.send = async (eventName, data = {}, timeout = 1000) => {
    return await new Promise(resolve => {
      const responseName = getResponseName(eventName);

      // cleanup function for the event listener
      let cleanup = (data = undefined) => {
        // clean up and become a noop so we can't be retriggered.
        socket.upgraded.off(responseName, handler);
        cleanup = () => {};
        // then route data forward
        resolve(data);
      };

      // In order to resolve the Promise, we will be listening
      // for that eventName:response, and when we receive it,
      // we'll immediately STOP listening for similar responses
      // because we no longer care.
      const handler = data => cleanup(data);

      // If no response has occurred within `timeout` milliseconds,
      // assume there will be no response and clean up the listener.
      setTimeout(() => cleanup(), timeout);

      // First, make sure we're ready to receive the response...
      socket.upgraded.on(responseName, handler);

      // And then, second, send the event off to the client.
      socket.send(
        JSON.stringify({
          name: eventName,
          payload: data
        })
      );
    });
  };

  // lastly, mark this socket as having been upgraded.
  socket[upgradeLabel] = true;

  return socket;
}

// this gets turned into "export default upgradeSocket;" by web serving
module.exports = upgradeSocket;
