import { WebSocket } from "ws";
import { CLIENT, BROWSER } from "./sources.js";

class RPCError {
  constructor(originName, message) {
    this.originName = originName;
    this.message = message;
  }
}

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
  receiver = ``;
  remote = ``;
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
  static upgrade(socket, origin, receiver, remote) {
    if (socket instanceof UpgradedSocket) return socket;
    // update the prototype binding
    Object.setPrototypeOf(socket, UpgradedSocket.prototype);
    // make sure that messages go through the router:
    socket.origin = origin;
    socket.receiver = receiver;
    socket.remote = remote;
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
    const { origin, receiver, remote } = this;

    // Any calls from the browser to the webclient are that's already handled
    // by the websocket directly (see the createWebClient function in index.js,
    // in the ws.on(`connection`, ...) block), so we need to make sure to not
    // try to "double-handle" that:
    if (remote === BROWSER) {
      return;
    }

    // browser websocket? If so, unwrap the data
    if (message.srcElement) {
      message = message.data;
    }

    let data;

    try {
      data = JSON.parse(message);
    } catch (e) {
      return console.error(`Could not parse websocket data: ${message}`);
    }

    const { name: eventName, payload, error: errorMsg, diff, seq_num } = data;
    let { state } = data;
    let throwable = errorMsg ? new RPCError(receiver, errorMsg) : undefined;

    console.log(`[${receiver}]/[${remote}] router running given:`, {
      eventName,
      payload,
      errorMsg,
      state,
      diff,
      seq_num,
    });

    // Client-state synchronization mechanism for the browser:
    if (state && receiver === BROWSER) {
      console.log(`handling state update in the browser`, state);
      console.log(`origin object:`, { origin });
      const prevState = JSON.parse(JSON.stringify(origin.state));
      if (diff) {
        console.log(`received diff`, state);
        const patch = state;
        let target;
        // verify we're still in sync by comparing messaging sequence numbers
        if (seq_num === origin.__seq_num + 1) {
          origin.__seq_num = seq_num;
          target = JSON.parse(JSON.stringify(prevState));
          console.log(`applying patch to`, target);
          // @ts-ignore: this only runs in the browser, where rfc6902 is a global.
          rfc6902.applyPatch(target, patch);
        } else {
          // if we get here, we're not in sync, and we need to request a full
          // state object instead of trying to apply differential updates.
          console.log(`seq_num mismatch, syncing state`);
          const fullState = await this.__send(`syncState`);
          origin.__seq_num = 0;
          target = fullState;
        }
        state = target;
      }
      // Run the update with the new state as argument first, then
      // overwrite the old state with the new state after the update.
      origin.state = state;
      return origin.update(prevState);
    }

    // If this is a response message, run the `on` handler for that.
    if (eventName.endsWith(RESPONSE_SUFFIX)) {
      const { handlers } = this;
      console.log(`[${receiver}] response message received`);
      if (!handlers[eventName]) throw new Error(`no handlers for ${eventName}`);
      handlers[eventName].forEach((handler) => {
        handler(throwable ? throwable : payload);
      });
      return;
    }

    // If we get here, this is a real RPC call rather than a response or state update.
    if (payload && !Array.isArray(payload)) {
      throw new Error(
        `[${receiver}] received payload for ${eventName} from [${remote}] but it was not an array? ${JSON.stringify(
          payload,
          null,
          2,
        )}`,
      );
    }

    // If it's a request message, resolve it to a function call and "return"
    // the value by sending a :response message over the websocket instead.
    const stages = eventName.split(`:`);
    console.log(`[${receiver}] router: stages:`, stages);

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
      if (receiver === `server`) payload.unshift(this.__proxy);
    } catch (e) {
      // "function not found" doesn't count as error "here".
      // Instead, we send that back to the caller.
      console.error(`cannot resolve ${eventName} on ${receiver}`, e);
      error = e.message;
    }

    // Resolve the function and then send the result as :response, making
    // sure to take into account that a call itself might throw.
    if (!error) {
      try {
        response = (await callable.bind(origin)(...payload)) ?? true;
        // If this is a webclient, and there is a browser connected,
        // also make sure to trigger a state sync, so that client code
        // does not need to include setState calls all over the place.
        if (receiver === CLIENT && origin.browser) {
          origin.setState(origin.state);
        }
      } catch (e) {
        console.error(
          `function invocation for ${eventName} failed on ${receiver}, payload:`,
          payload,
        );
        console.error(e);
        error = e.message;
      }
    }

    // Send off a response message with either the result, or the error.
    const responseName = getResponseName(eventName);
    console.log(`[${receiver}] sending ${responseName}`, {
      payload: response,
      error,
    });
    super.send(
      JSON.stringify({ name: responseName, payload: response, error }),
    );
  }

  /**
   * this.upgraded.on() made to work like .addEventListener()
   */
  __on(eventName, handler) {
    const { handlers } = this;
    if (!handlers[eventName]) handlers[eventName] = [];
    handlers[eventName].push(handler);
    // return the corresponding "off" function, for convenience.
    return () => this.__off(eventName, handler);
  }

  /**
   * this.upgraded.off() made to work like .removeEventListener()
   */
  __off(eventName, handler) {
    const { handlers } = this;
    if (!handlers[eventName]) return;
    const pos = handlers[eventName].indexOf(handler);
    handlers[eventName].splice(pos, 1);
  }

  /**
   * Add a promise-based emit/receive to the socket, so that calling code can `await` the response.
   *
   * Note that there is an optional third argument `timeout` that can be used to say how long the
   * emit should wait before deciding there is no response forthcoming and to clean up the event
   * listener for that response. The default timeout is 1000ms.
   */
  async __send(eventName, data = {}, timeout = 1000) {
    const { receiver, remote } = this;
    console.log(`[${receiver}] sending [${eventName}] to [${remote}]:`, data);
    return await new Promise((resolve, reject) => {
      const responseName = getResponseName(eventName);

      // cleanup function for the event listener
      let cleanup = (data = undefined) => {
        console.log(`[${receiver}] cleanup`);
        // clean up and become a noop so we can't be retriggered.
        this.__off(responseName, handler);
        cleanup = () => {};
        resolve(data);
      };

      // In order to resolve the Promise, we will be listening
      // for that eventName:response, and when we receive it,
      // we'll immediately STOP listening for similar responses
      // because we no longer care.
      const handler = (data) => cleanup(data);

      // First, make sure we're ready to receive the response...
      this.__on(responseName, (data) => {
        console.log(
          `[${receiver}] handling response for ${eventName} from [${remote}]:`,
        );
        handler(data);
      });

      // And then, send the event off to the client.
      const sendEvent = () => {
        console.log(`(raw) sending ${eventName} from ${receiver} to ${remote}`);
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
 * A socket proxy for RPC purposes.
 */
class SocketProxy extends Function {
  constructor(socket, receiver, remote, path = ``) {
    super();
    this.receiver = receiver;
    this.remote = remote;
    this.id = uuid();
    this.path = path;
    this.socket = socket;
    return new Proxy(this, {
      get: (_, prop) => {
        if (prop === "id") return this.id;
        if (prop === "socket") return this.socket;
        // @ts-ignore: we're never invoking this with Symbol as second argument
        return new SocketProxy(socket, receiver, remote, `${path}:${prop}`);
      },
      apply: async (_, __, args) => {
        console.log(
          `[SPapply] sending ${this.path.substring(1)} receiver ${
            this.receiver
          } to ${this.remote}`,
        );
        const data = await this.socket.upgraded.send(
          this.path.substring(1),
          args,
        );
        if (data instanceof RPCError) {
          const argstr = [...new Array(args.length)]
            .map((_, i) => String.fromCharCode(97 + i))
            .join(`,`);
          console.error(
            `ERROR calling [[${data.originName}]].${this.path
              .substring(1)
              .replaceAll(`:`, `.`)}(${argstr}): ${data.message}`,
          );
          throw new Error(data.message);
        }
        return data;
      },
    });
  }
}

/**
 * ..docs go here...
 * @param {string} receiver
 * @param {string} remote
 * @param {*} origin
 * @param {*} socket
 * @returns
 */
export function proxySocket(receiver, remote, origin, socket) {
  socket = UpgradedSocket.upgrade(socket, origin, receiver, remote);
  return (socket.__proxy = new SocketProxy(socket, receiver, remote));
}

if (typeof process !== `undefined`) {
  process.on("unhandledRejection", (reason, p) => {
    console.log("Unhandled Rejection at: Promise", p, "reason:", reason);
    // application specific logging, throwing an error, or other logic here
    console.trace();
  });
}
