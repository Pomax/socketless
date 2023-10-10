import { WebSocket } from "ws";
import { log } from "./logger.js";

// responses should always be "the event name, with :response added"
function getResponseName(eventName) {
  return `${eventName}:response`;
}

/**
 * ...
 */
class UpgradedSocket extends WebSocket {
  // explicitly forbid the constructor from being used.
  // @ts-ignore: we don't need to call super() if we error out.
  constructor() {
    throw new Error(
      "Cannot create UpgradedSocket instances. Use UpgradedSocket.upgrade(socket) instead."
    );
  }

  // upgrade a socket from plain WebSocket to this class instead.
  static upgrade(name, origin, socket) {
    if (socket instanceof UpgradedSocket) return socket;
    // update the prototype binding
    Object.setPrototypeOf(socket, UpgradedSocket.prototype);
    // make sure that messages go through the router:
    socket.origin = origin;
    origin.__name = name;
    socket.handlers = {};
    const messageRouter = socket.router.bind(socket);
    if (socket.on) {
      socket.on(`message`, messageRouter);
    } else {
      socket.onmessage = messageRouter;
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
  async router(message) {
    // browser websocket? If so, unwrap the data
    if (message.srcElement) {
      message = message.data;
    }

    let data;

    try {
      data = JSON.parse(message);
    } catch (e) {
      return console.error("Could not parse websocket data:", message);
    }

    const { origin } = this;
    const { name: eventName, payload, error: errorMsg } = data;

    console.log(`debugdebug`, origin.__name, eventName, payload, errorMsg);

    // If this is a response message, run the `on` handler for that.
    if (eventName.includes(`:response`)) {
      const { handlers } = this;
      log(`[${origin.__name}] response message received`);
      if (!handlers[eventName]) throw new Error(`no handlers for ${eventName}`);
      handlers[eventName].forEach((handler) => {
        if (errorMsg) handler(new Error(errorMsg));
        else handler(payload);
      });
    }

    // If it's a request message, resolve it to a function call and "return"
    // the value by sending a :response message over the websocket instead.
    else {
      const stages = eventName.split(`:`);
      log(`[${origin.__name}] router: stages:`, stages);

      let callable = origin;
      let error = undefined;
      let response = undefined;

      try {
        while (stages.length) {
          const stage = stages.shift();
          log(`checking ${stage}`);
          callable = callable[stage];
        }

        // If this code runs on the server, the function needs to be called
        // with the reply-socket as first argument:
        if (origin.__name === `server`) {
          const other = new SocketProxy(this); // not a fan of this, can we get this from somewhere "once"?
          payload.unshift(other);
        }
      } catch (e) {
        error = e.message;
      }

      // Resolve the function and then send the result as :response,
      // making sure to take into account that a call might lead to an exception
      if (!error) {
        try {
          response = (await callable.bind(origin)(...payload)) ?? true;
        } catch (e) {
          error = e.message;
        }
      }

      // Send off a response message with either the result, or the error.
      super.send(
        JSON.stringify({
          name: getResponseName(eventName),
          payload: response,
          error,
        })
      );
    }
  }

  // Redefine .on() so that it works like .addEventListener()
  __on(eventName, handler) {
    const { handlers } = this;
    if (!handlers[eventName]) handlers[eventName] = [];
    handlers[eventName].push(handler);
    // return the corresponding "off" function, for convenience.
    return () => this.__off(eventName, handler);
  }

  // Redefine .off() so that it  works like .removeEventListener()
  __off(eventName, handler) {
    const { handlers } = this;
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
    log(`[upgraded send]`, eventName, data);
    const originName = this.origin.__name;

    return await new Promise((resolve) => {
      const responseName = getResponseName(eventName);

      // cleanup function for the event listener
      let cleanup = (data = undefined) => {
        log(`[${originName}] cleanup`);
        // clean up and become a noop so we can't be retriggered.
        this.__off(responseName, handler);
        cleanup = () => { };
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
        log(`[${originName}] handling response...`);
        handler(data);
      });

      // And then, send the event off to the client.
      const sendEvent = () => {
        log(`(raw) sending ${eventName} from ${originName} to other party`);
        super.send(
          JSON.stringify({
            name: eventName,
            payload: data,
          })
        );
      };

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

export function upgradeSocket(origin, socket) {
  return UpgradedSocket.upgrade(origin, socket);
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
        // @ts-ignore: we're never invoking this with Symbols
        return new SocketProxy(socket, `${path}:${prop}`);
      },
      apply: async (_, __, args) => {
        console.log(
          `sending ${this.path.substring(1)} from ${this.socket.origin.__name
          } to destination`
        );
        const result = await this.socket.upgraded.send(
          this.path.substring(1),
          args
        );
        if (result instanceof Error) throw result;
        return result;
      },
    });
  }
}

export function proxySocket(name, origin, socket) {
  const upgradedSocket = UpgradedSocket.upgrade(name, origin, socket);
  return (upgradedSocket.__proxy = new SocketProxy(upgradedSocket));
}
