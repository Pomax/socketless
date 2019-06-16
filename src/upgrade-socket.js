/**
 * This function takes a standard Socket.io socket,
 * and makes it better by rewriting the `on` and `emit`
 * functions so that they can autorespond, and be used
 * with `await`, respectively. This means you can write
 * code like this:
 *
 *   let data = socket.emit('get-me-stuff', input);
 *   handleResult(data);
 *
 * as well as this:
 *
 *   socket.on('get-me-stuff', (input, respond) => {
 *     let output = formOutput(input);
 *     respond(output);
 *   })
 *
 * And that's just so much nicer than plain Socket.io
 */
function upgradeSocket(socket) {

  // don't upgrade an already-upgraded socket
  if (socket.__upgraded) return socket;

  // original functions
  const __emit = socket.emit.bind(socket);
  const __on = socket.on.bind(socket);

  /**
   * Add a promise-based emit/receive to the socket,
   * so that server code can `await` the client's
   * response in an asynchronous fashion. Note that there
   * is an optional third argument `timeout` that can be
   * used to say how long the emit should wait before
   * deciding there is no response forthcoming and to clean
   * up the event listener for that response.
   */
  socket.emit = async (eventName, data={}, timeout=5000) => {
    return new Promise((resolve, reject) => {

      // responses should always be "the event name, with :response added"
      const responseName = `${eventName}:response`;

      // cleanup function for the event listener
      let cleanup = (data=undefined) => {
        // clean up
        socket.removeListener(responseName, listener);
        // send data
        resolve(data);
        // and then become a noop
        cleanup = () => {};
      }

      // In order to resolve the Promise, we will be listening
      // for that :response, and when we receive it, we'll immediately
      // STOP listening for similar responses because we no longer care.
      const listener = data => cleanup(data);

      // If no response has occurred within `timeout` milliseconds,
      // assume there will be no response and clean up the listener.
      setTimeout(() => cleanup(), timeout);

      // First, make sure we're ready to receive the response...
      __on(responseName, listener);

      // And then, second, send the event off to the client.
      __emit(eventName, data);
    });
  };

  /**
   * Add a way for clients to respond without having to copy
   * event names etc.
   */
  socket.on = (eventName, handler) => {
    // We fall through to "on", but instead of just returning
    // the data, we return the data as well as a function that
    // can be called to effect a response with the event name
    // updated so that it will be picked up by the above `emit()`
    //
    // Note that the normal socket.on(evtname, data => {...})
    // still works the same, so this rewrite doesn't interfere
    // with existing code.
    __on(eventName, data => {
      handler(data, function respond(responseData) {
        __emit(`${eventName}:response`, responseData);
      });
    });
  };

  socket.__upgraded = true;

  return socket;
};

// this gets turned into "export default upgradeSocket;" by web serving
module.exports = upgradeSocket;
