import { WebSocket } from "ws";

const DEBUG = false;

// importing uuid is way too expensive for what we need here
function uuid() {
  const now = Date.now().toString(16);
  const rdm = ((1e6 * Math.random()) | 0).toString(16);
  return `${now}-${rdm}`;
}

// responses should always be "the event name, with :response added"
const RESPONSE_SUFFIX = `:response`;
export const getResponseName = (eventName) => `${eventName}${RESPONSE_SUFFIX}`;

/**
 * ...
 */
class UpgradedSocket extends WebSocket {
  origin = undefined; // the socket owner who invoked the upgrade. See upgrade()
  __proxy = undefined; // the proxy object associated with this socket
  handlers = {}; // the list of event handlers. See upgrade()

  // explicitly forbid the constructor from being used.
  // @ts-ignore: we don't need to call super() if we error out.
  constructor() {
    throw new Error(
      "Cannot create UpgradedSocket instances. Use UpgradedSocket.upgrade(name, origin, socket) instead.",
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
    const { origin } = this;
    const originName = origin.__name;

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

    const {
      name: eventName,
      payload,
      error: errorMsg,
      state,
      diff,
      seq_num,
    } = data;

    let throwable = errorMsg ? new Error(errorMsg) : undefined;

    if (DEBUG)
      console.log(`debugdebug`, originName, eventName, payload, errorMsg);

    // Client-state synchronization mechanism for the browser:
    if (state && originName === `webclient`) {
      if (diff) {
        if (DEBUG) console.log(`received diff`, state);
        const patch = state;
        let target;
        // verify we're still in sync by comparing messaging sequence numbers
        if (seq_num === origin.__seq_num + 1) {
          origin.__seq_num = seq_num;
          target = JSON.parse(JSON.stringify(origin.state));
          // @ts-ignore: this only runs in the browser, where rfc6902 is a global.
          rfc6902.applyPatch(target, patch);
        } else {
          // if we get here, we're not in sync, and we need to request a full
          // state object instead of trying to apply differential updates.
          const fullState = await this.__send(`syncState`);
          origin.__seq_num = 0;
          target = fullState;
        }
        return origin.update(target);
      }
      return origin.update(state);
    }

    // If this is a response message, run the `on` handler for that.
    if (eventName.endsWith(RESPONSE_SUFFIX)) {
      const { handlers } = this;
      if (DEBUG) console.log(`[${originName}] response message received`);
      if (!handlers[eventName]) throw new Error(`no handlers for ${eventName}`);
      handlers[eventName].forEach((handler) => {
        handler(throwable ? throwable : payload);
      });
      return;
    }

    // If it's a request message, resolve it to a function call and "return"
    // the value by sending a :response message over the websocket instead.
    if (originName !== `browser`) {
      const stages = eventName.split(`:`);
      if (DEBUG) console.log(`[${originName}] router: stages:`, stages);

      let callable = origin;
      let forbidden = origin.__proto__?.constructor.disallowedCalls ?? [];
      let error = undefined;
      let response = undefined;

      // Find the actual function to call
      try {
        const [first] = stages;
        if (stages.length === 1 && forbidden.includes(first)) {
          throw new Error(`Illegal call: ${first} is a protected method`);
        }
        while (stages.length) {
          const stage = stages.shift();
          if (DEBUG) console.log(`checking ${stage}`);
          callable = callable[stage];
        }
        // If this code runs on the server, the function needs to be
        // called with the client proxy as first argument.
        if (originName === `server`) payload.unshift(this.__proxy);
      } catch (e) {
        // "function not found" doesn't count as error "here".
        // Instead, we send that back to the caller.
        error = e.message;
      }

      // Resolve the function and then send the result as :response, making
      // sure to take into account that a call itself might throw.
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
        }),
      );
    }
  }

  /**
   * Redefine .on() so that it works like .addEventListener()
   */
  __on(eventName, handler) {
    const { handlers } = this;
    if (!handlers[eventName]) handlers[eventName] = [];
    handlers[eventName].push(handler);
    // return the corresponding "off" function, for convenience.
    return () => this.__off(eventName, handler);
  }

  /**
   * Redefine .off() so that it  works like .removeEventListener()
   */
  __off(eventName, handler) {
    const { handlers } = this;
    if (!handlers[eventName]) return;
    const pos = handlers[eventName].indexOf(handler);
    handlers[eventName].splice(pos, 1);
  }

  /**
   * Add a promise-based emit/receive to the socket, so that calling code can  `await` the response.
   *
   * Note that there is an optional third argument `timeout` that can be used to say how long the
   * emit should wait before deciding there is no response forthcoming and to clean up the event
   * listener for that response.
   */
  async __send(eventName, data = {}, timeout = 1000) {
    if (DEBUG) console.log(`[upgraded send]`, eventName, data);
    const originName = this.origin.__name;
    return await new Promise((resolve, reject) => {
      const responseName = getResponseName(eventName);

      // cleanup function for the event listener
      let cleanup = (data = undefined) => {
        if (DEBUG) console.log(`[${originName}] cleanup`);
        // clean up and become a noop so we can't be retriggered.
        this.__off(responseName, handler);
        cleanup = () => {};
        // then route data forward
        if (data instanceof Error) reject(data);
        else resolve(data);
      };

      // In order to resolve the Promise, we will be listening
      // for that eventName:response, and when we receive it,
      // we'll immediately STOP listening for similar responses
      // because we no longer care.
      const handler = (data) => cleanup(data);

      // First, make sure we're ready to receive the response...
      this.__on(responseName, (data) => {
        if (DEBUG)
          console.log(`[${originName}] handling response for ${eventName}:`);
        handler(data);
      });

      // And then, send the event off to the client.
      const sendEvent = () => {
        if (DEBUG)
          console.log(
            `(raw) sending ${eventName} from ${originName} to other party`,
          );
        super.send(
          JSON.stringify({
            name: eventName,
            payload: data,
          }),
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

/**
 * ...docs go here...
 * @param {*} origin
 * @param {*} socket
 * @returns
 */
export function upgradeSocket(origin, socket) {
  return UpgradedSocket.upgrade(origin, socket);
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
        if (DEBUG)
          console.log(
            `sending ${this.path.substring(1)} from ${
              this.socket.origin.__name
            } to destination`,
          );
        return await this.socket.upgraded.send(this.path.substring(1), args);
      },
    });
  }
}

/**
 * ...docs go here...
 * @param {*} name
 * @param {*} origin
 * @param {*} socket
 * @returns
 */
export function proxySocket(name, origin, socket) {
  const upgradedSocket = UpgradedSocket.upgrade(name, origin, socket);
  return (upgradedSocket.__proxy = new SocketProxy(upgradedSocket));
}
