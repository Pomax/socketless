import { WebSocket } from "ws";

if (typeof process !== "undefined" && process.release.name === `node`) {
  // We do not want Node to artificially limit us to 10 sockets
  process.setMaxListeners(0);
}

// Special event names that require lower-level handling than the message router.
const RESERVED = [`close`, `error`, `open`, `ping`, `pong`];
const BROWSER_RESERVED = [`onDisconnect`];

// responses should always be "the event name, with :response added"
function getResponseName(eventName) {
  return `${eventName}:response`;
}

/**
 * This class has a static `upgrade(socket)` that takes
 * a standard websocket, and makes it better by updating
 * the  `on`, `off`, and `send` functions so that they
 * can auto-respond, and be used with `await`, respectively.
 * This means you
 * can write code like this:
 *
 *   let data = await socket.send('get-me-stuff', input);
 *   handleResult(data);
 *
 * as well as this:
 *
 *   const handlerStuff = (input, respond) => {
 *     let output = formOutput(input);
 *     respond(output);
 *   };
 *
 *   socket.on('get-me-stuff', handleStuff);
 *
 * with a corresponding off:
 *
 *   socket.off('get-me-stuff', handleStuff);
 *
 * And that's just so much nicer than plain websockets.
 */
class UpgradedSocket extends WebSocket {
  // message handler map
  handlers = {};

  // explicitly forbid the constructor from being used.
  // @ts-ignore: we don't need to call super() if we error out.
  constructor() {
    throw new Error(
      "Cannot create UpgradedSocket instances. Use UpgradedSocket.upgrade(socket) instead."
    );
  }

  // upgrade a socket from plain WebSocket to this class instead.
  static upgrade(socket) {
    if (socket instanceof UpgradedSocket) return socket;
    // update the prototype binding
    Object.setPrototypeOf(socket, UpgradedSocket.prototype);
    // initialize the handlers map
    socket.handlers = {};
    // make sure that messages go thorugh the router:
    const routeData = socket.router.bind(socket);
    if (socket.on) {
      socket.on(`message`, routeData);
    } else {
      socket.onmessage = routeData;
    }
    // convenience return.
    return socket;
  }

  // Special accessor for upgraded socket functions
  get upgraded() {
    if (!this.__upgraded) {
      this.__upgraded = {
        on: (...args) => this.__on(...args),
        off: (...args) => this.__off(...args),
        send: (...args) => this.__send(...args),
      };
    }
    return this.__upgraded;
  }

  // message router specifically for the message format used by the socketless code.
  router(data) {
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

    // don't handle reserved message types.
    if (BROWSER_RESERVED.indexOf(eventName) > -1) {
      return console.warn(`ignoring browser ${eventName} event`);
    }

    const { handlers } = this;

    // do we know how to handle this message? if not, the people writing
    // the socketless-using code forgot something and should be made aware.
    if (!handlers[eventName]) {
      throw new Error(`no handlers for ${eventName}`);
    }

    handlers[eventName].forEach((handler) => {
      handler(payload, (responseData) => {
        this.__send(getResponseName(eventName), responseData);
      });
    });
  }

  // Redefine .on() so that it works like .addEventListener()
  __on(eventName, handler) {
    const { handlers } = this;
    // reserved events go straight on the socket itself
    if (RESERVED.indexOf(eventName) > -1) {
      super.addEventListener(eventName, handler);
    }
    // everything else gets added to the appropriate handling bin.
    else {
      if (!handlers[eventName]) handlers[eventName] = [];
      handlers[eventName].push(handler);
    }
    // return the corresponding "off" function, for convenience.
    return () => this.__off(eventName, handler);
  }

  // Redefine .off() so that it  works like .removeEventListener()
  __off(eventName, handler) {
    const { handlers } = this;
    if (RESERVED.indexOf(eventName) > -1) {
      return super.removeEventListener(eventName, handler);
    }
    if (!handlers[eventName]) return;
    const pos = handlers[eventName].indexOf(handler);
    handlers[eventName].splice(pos, 1);
  }

  // Add a promise-based emit/receive to the socket, so that calling code can
  // `await` the response. Note that there is an optional third argument
  // `timeout` that can be used to say how long the emit should wait before
  // deciding there is no response forthcoming and to clean up the event
  // listener for that response.
  async __send(eventName, data = {}, timeout = 1000) {
    return await new Promise((resolve) => {
      const responseName = getResponseName(eventName);

      // cleanup function for the event listener
      let cleanup = (data = undefined) => {
        // clean up and become a noop so we can't be retriggered.
        this.__off(responseName, handler);
        cleanup = () => {};
        // then route data forward
        resolve(data);
      };

      // In order to resolve the Promise, we will be listening
      // for that eventName:response, and when we receive it,
      // we'll immediately STOP listening for similar responses
      // because we no longer care.
      const handler = (data) => cleanup(data);

      // First, make sure we're ready to receive the response...
      this.__on(responseName, (data) => {
        handler(data);
      });

      // And then, send the event off to the client.
      const sendEvent = () =>
        super.send(
          JSON.stringify({
            name: eventName,
            payload: data,
          })
        );

      // We may be trying to send before the socket is open in browser land,
      // so if the socket's not ready, "queue" the event to fire on open.
      if (super.readyState === 1) sendEvent();
      else super.onopen = sendEvent;

      // And make sure that if no response has occurred within
      // `timeout` milliseconds, we clean up the listener.
      setTimeout(() => cleanup(), timeout);
    });
  }
}

export function upgradeSocket(socket) {
  return UpgradedSocket.upgrade(socket);
}

// importing uuid is way too expensive.
function uuid() {
  const now = Date.now().toString(16);
  const rdm = ((1e6 * Math.random()) | 0).toString(16);
  return `${now}-${rdm}`;
}

/**
 * A socket proxy for RPC
 */
class SocketProxy extends Function {
  constructor(socket, path = ``) {
    super();
    this.id = uuid();
    this.path = path;
    this.socket = socket;
    return new Proxy(this, {
      get: (_, prop) => {
        if (prop === "id") return this.id;
        if (prop === "socket") return this.socket;
        if (prop === "__socket") return this.socket;
        // @ts-ignore: we're never invoking this with Symbols
        return new SocketProxy(socket, `${path}:${prop}`);
      },
      apply: (_, __, args) =>
        this.socket.upgraded.send(this.path.substring(1), args),
    });
  }
}

export function proxySocket(socket) {
  return new SocketProxy(UpgradedSocket.upgrade(socket));
}
