/**
 * This file houses the core of the RPC functionality.
 *
 * The `UpgradedSocket` class is an extension on the WebSocket class that adds
 * custom on/off/send methods (exposed through a socket.upgraded object), set
 * up to handle automatic responses to calls. Incoming WebSocket messages are
 * routed into the `router` function, which has behaviour tailored to specific
 * origins, and makes sure that messages are always responded to.
 *
 * The `__send` function, in turn, doesn't just send data over to a remote, but
 * also waits for that remote's :response message, using Promises to make
 * sure that anyone can `await socket.upgraded.send(...)` and get a response
 * once that response has been sent back. As far as calling code is concerned,
 * this is a normal async call, and the fact that network transport happened
 * is entirely irrelevant. Callers should not care.
 *
 * The `SocketProxy` is a clever little Proxy object that extends the Function
 * built-in, which allows us to create a recursive object where any property
 * on it is a valid function to call, and doing so will send the corresponding
 * call chain over to the remote for execution and response messaging. This way,
 * we don't need to perform any "which functions are supported", we can just proxy
 * the call over the network, if it exists, it runs, if it doesn't, then we'll
 * get a result back with an `error` message that we can turn into a local throw.
 */

import { WebSocket } from "ws";
import { CLIENT, BROWSER, deepCopy } from "./utils.js";

const DEBUG = false;

// Used to prevent the browser from trying to modify the state variable,
// which would invalidate the diff/patch approach to state management.
const lockObject = (input) => {
  Object.keys(input).forEach((key) => {
    if (typeof input[key] === "object" && !Object.isFrozen(input[key]))
      lockObject(input[key]);
  });
  return Object.freeze(input);
};

// Used as "temporary" error object before throwing a real Error.
class RPCError {
  constructor(originName, message) {
    this.originName = originName;
    this.message = message;
  }
}

// importing the uuid package is way too expensive for what we need here
function uuid() {
  const now = Date.now().toString(16);
  const rdm = ((1e6 * Math.random()) | 0).toString(16);
  return `${now}-${rdm}`;
}

// responses should always be "the event name, with :response added"
export const RESPONSE_SUFFIX = `:response`;
export const getResponseName = (eventName) => `${eventName}${RESPONSE_SUFFIX}`;

// use symbols so we don't pollute the socket prototype
const ORIGIN = Symbol(`origin`);
const PROXY = Symbol(`proxy`);
const RECEIVER = Symbol(`receiver`);
const REMOTE = Symbol(`remote`);
const HANDLERS = Symbol(`handlers`);

/**
 * ...do docs go here?
 */
class UpgradedSocket extends WebSocket {
  [ORIGIN] = undefined; // the socket owner who invoked the upgrade. See upgrade()
  [PROXY] = undefined; // the proxy object associated with this socket
  [RECEIVER] = ``; // name of the receiving object
  [REMOTE] = ``; // name of the remote object
  [HANDLERS] = {}; // the list of event handlers. See upgrade()

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
    socket[ORIGIN] = origin;
    socket[RECEIVER] = receiver;
    socket[REMOTE] = remote;
    socket[HANDLERS] = {};
    const messageRouter = socket.router.bind(socket);
    if (socket.on) {
      socket.on(`message`, messageRouter);
    } else {
      socket.onmessage = messageRouter;
    }

    // convenience return.
    return socket;
  }

  // Special accessor for upgraded socket functions,
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
  async router(message, forced = false) {
    const { [ORIGIN]: origin, [RECEIVER]: receiver, [REMOTE]: remote } = this;

    // Any calls from the browser to the webclient are that's already handled
    // by the websocket directly (see the createWebClient function in index.js,
    // in the ws.on(`connection`, ...) block), so we need to make sure to not
    // try to "double-handle" that:
    if (remote === BROWSER && !forced) {
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

    if (DEBUG)
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
      if (DEBUG) console.log(`handling state update in the browser`, state);
      if (DEBUG) console.log(`origin object:`, { origin });
      const prevState = deepCopy(origin.state);
      if (diff) {
        if (DEBUG) console.log(`received diff`, state);
        const patch = state;
        let target;
        // verify we're still in sync by comparing messaging sequence numbers
        if (seq_num === origin.__seq_num + 1) {
          origin.__seq_num = seq_num;
          target = deepCopy(prevState);
          if (DEBUG) console.log(`applying patch to`, target);
          // @ts-ignore: this only runs in the browser, where rfc6902 is a global.
          rfc6902.applyPatch(target, patch);
        } else {
          // if we get here, we're not in sync, and we need to request a full
          // state object instead of trying to apply differential updates.
          if (DEBUG) console.log(`seq_num mismatch, syncing state`);
          const fullState = await this.__send(`syncState`);
          origin.__seq_num = 0;
          target = fullState;
        }
        state = target;
      }
      // Run the update with the new state as argument first, then
      // overwrite the old state with the new state after the update.
      if (state) {
        lockObject(state);
        origin.state = state;
        origin.update?.(prevState);
      }
      return;
    }

    // If this is a response message, run the `on` handler for that.
    if (eventName.endsWith(RESPONSE_SUFFIX)) {
      const { [HANDLERS]: handlers } = this;
      if (DEBUG) console.log(`[${receiver}] response message received`);
      if (!handlers[eventName]) throw new Error(`no handlers for ${eventName}`);
      handlers[eventName].forEach((handler) => {
        handler(throwable ? throwable : payload);
      });
      return;
    }

    // If it's a request message, resolve it to a function call and "return"
    // the value by sending a :response message over the websocket instead.
    const stages = eventName.split(`:`);
    if (DEBUG) console.log(`[${receiver}] router: stages:`, stages);

    // placeholders for our response and potential call errors
    let response = undefined;
    let error = undefined;

    // Are we even allowed to resolve this chain?
    const [first] = stages;
    let forbidden = origin.__proto__?.constructor.disallowedCalls ?? [];
    if (first && forbidden.includes(first)) {
      error = `Illegal call: ${first} is a protected property`;
    }

    // We'll be stepping into "callable", making sure that each time
    // we step deeper, we update the call context to the
    let context = origin;
    let callable = origin;

    // We are: find the actual function to call.
    if (!error) {
      try {
        while (stages.length) {
          const stage = stages.shift();
          if (DEBUG) console.log(`checking ${stage}`);
          context = callable;
          callable = callable[stage];
        }
        // If this code runs on the server, the function needs to be
        // called with the client proxy as first argument.
        if (receiver === `server`) payload.unshift(this[PROXY]);
      } catch (e) {
        // "function not found" doesn't count as error "here".
        // Instead, we send that back to the caller.
        if (DEBUG)
          console.error(`cannot resolve ${eventName} on ${receiver}`, e);
        error = e.message;
      }
    }

    // Resolve the function and then send the result as :response, making
    // sure to take into account that a call itself might throw.
    if (!error) {
      try {
        response = (await callable.bind(context)(...payload)) ?? true;
        // If this is a webclient, and there is a browser connected,
        // also make sure to trigger a state sync, so that client code
        // does not need to include setState calls all over the place.
        if (receiver === CLIENT && origin.browser) {
          origin.setState(origin.state);
        }
      } catch (e) {
        if (DEBUG)
          console.error(
            `function invocation for ${eventName} failed on ${receiver}, payload:`,
            payload,
          );
        if (DEBUG) console.error(e);
        let reason = e.message;
        if (reason.includes(`(reading 'bind')`)) {
          reason = `function is undefined.`;
        } else {
          reason = `function threw instead of returning (${reason})`;
        }
        error = `Cannot call [[${receiver}]].${eventName.replaceAll(
          `:`,
          `.`,
        )}, ${reason}`;
      }
    }

    // Send off a response message with either the result, or the error.
    const responseName = getResponseName(eventName);
    if (DEBUG)
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
    const { [HANDLERS]: handlers } = this;
    if (!handlers[eventName]) handlers[eventName] = [];
    handlers[eventName].push(handler);
    // return the corresponding "off" function, for convenience.
    return () => this.__off(eventName, handler);
  }

  /**
   * this.upgraded.off() made to work like .removeEventListener()
   */
  __off(eventName, handler) {
    const { [HANDLERS]: handlers } = this;
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
    const { [RECEIVER]: receiver, [REMOTE]: remote } = this;
    if (DEBUG)
      console.log(`[${receiver}] sending [${eventName}] to [${remote}]:`, data);
    return await new Promise((resolve, reject) => {
      const responseName = getResponseName(eventName);

      // cleanup function for the event listener
      let cleanup = (data = undefined) => {
        if (DEBUG) console.log(`[${receiver}] cleanup`);
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
        if (DEBUG)
          console.log(
            `[${receiver}] handling response for ${eventName} from [${remote}]:`,
          );
        handler(data);
      });

      // And then, send the event off to the client.
      const sendEvent = () => {
        if (DEBUG)
          console.log(
            `(raw) sending ${eventName} from ${receiver} to ${remote}`,
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
      if (isFinite(timeout)) {
        setTimeout(() => cleanup(), timeout);
      }
    });
  }
}

/**
 * A socket proxy for RPC purposes.
 */
class SocketProxy extends Function {
  constructor(socket, receiver, remote, path = ``) {
    super();
    this[RECEIVER] = receiver;
    this[REMOTE] = remote;
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
        // We need to capture the current stack trace if we want to throw an
        // error later. If we build a new Error after we await the server call,
        // the stack trace is basically going to be "this function" which isn't
        // super useful for letting folks fix their code.
        let callError;
        try {
          throw new Error();
        } catch (e) {
          callError = e;
        }

        // Try to resolve the network call:
        const call = this.path.substring(1);
        const timeout = this[REMOTE] === BROWSER ? Infinity : undefined;
        const data = await this.socket.upgraded.send(call, args, timeout);

        if (data instanceof RPCError) {
          // Fix up our error so it has the correct message and
          // stack trace, then throw for the user to deal with.
          let line;
          let lines = callError.stack.split(`\n`);
          do {
            line = lines.shift();
          } while (!line.includes(`apply`));
          callError.message = data.message;
          callError.stack =
            `CallError: ${callError.message}\n` + lines.join(`\n`);
          throw callError;
        }

        return data;
      },
    });
  }
}

/**
 * Create a proxied socket where the caller literally doesn't need
 * to care, they just need to call functions as if they're locals.
 *
 * @param {string} receiver The name of the receiver for this socket
 * @param {string} remote The name of the remote for this socket
 * @param {*} origin The calling object, used for things like "illegal fnames", state management, etc.
 * @param {*} socket The socket we're wrapping.
 * @returns
 */
export function proxySocket(receiver, remote, origin, socket) {
  socket = UpgradedSocket.upgrade(socket, origin, receiver, remote);
  return (socket[PROXY] = new SocketProxy(socket, receiver, remote));
}
