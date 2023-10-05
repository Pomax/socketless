import { upgradeSocket } from "../util/upgrade-socket.js";

export function createServerCallHandler(
  namespace,
  clientFn,
  resolveWithoutNamespace,
) {
  // Define the handler object that the client can use to respond to
  // messages initiated by the server. (although responses may not be
  // required on a per-message basis).
  //
  // This is effectively the "true callable client API".

  function ServerCallHandler(socketFromServer, handler) {
    let socket = (this.socket = upgradeSocket(socketFromServer));
    this.handler = handler;
    clientFn.forEach((name) => {
      socket.upgraded.on(`${namespace}:${name}`, (data, respond) =>
        this[name](data, respond),
      );
    });
  }

  ServerCallHandler.prototype = {};

  clientFn.forEach((name) => {
    // The initial binding has to "find" the function that needs to be used.
    ServerCallHandler.prototype[name] = async function (data, respond) {
      // Determing whether we can use explicit namespacing:
      let process = this.handler[`${namespace}:${name}`];
      if (!process) process = this.handler[`${namespace}$${name}`];
      if (!process && resolveWithoutNamespace) process = this.handler[name];

      // Throw if there is no processing function at all:
      if (!process) {
        throw new Error(
          `Missing handler.${namespace}:${name} in ServerCallHandler.${namespace}.${name}`,
        );
      }

      // There used to be a check for async-ness here, but that check is now
      // performed much earlier, when API functions are extracted.

      // ensure that the function will run with the
      // correct object as its execution context:
      process = process.bind(this.handler);

      let response = await process(data);
      if (response) respond(response);

      // TODO: optimise this so that ServerCallHandler.prototype[name] gets rebound after the initial process() lookup.
    };
  });

  ServerCallHandler.api = clientFn;

  return ServerCallHandler;
}
