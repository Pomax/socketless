import { upgradeSocket } from "../util/upgraded-socket.js";

export function createClientCallHandler(
  namespace,
  serverFn,
  resolveWithoutNamespace
) {
  // Define the handler object that the server can use to respond to
  // messages initiated by the client. (although responses may not be
  // required on a per-message basis).
  //
  // This is effectively the "true callable server API".

  const ClientCallHandler = function(socketFromClient, handler) {
    let socket = (this.socket = upgradeSocket(socketFromClient));
    this.handler = handler;
    serverFn.forEach((name) => {
      socket.upgraded.on(`${namespace}:${name}`, (data, respond) =>
        this[name](data, respond)
      );
    });
  };

  ClientCallHandler.prototype = {};

  serverFn.forEach((name) => {
    // The initial binding has to "find" the function that needs to be used.
    ClientCallHandler.prototype[name] = async function (data, respond) {
      // Determine whether we can use explicit namespacing:
      let process = this.handler[`${namespace}:${name}`];
      if (!process) process = this.handler[`${namespace}$${name}`];
      if (!process && resolveWithoutNamespace) process = this.handler[name];

      // Throw if there is no processing function at all:
      if (!process) {
        throw new Error(
          `Missing handler.${namespace}:${name} in ClientCallHandler.${namespace}.${name}`
        );
      }

      // There used to be a check for async-ness here, but that check is now
      // performed much earlier, when API functions are extracted.

      // ensure that the function will run with the
      // correct object as its execution context:
      process = process.bind(this.handler);

      // As we now know which function to actually route through, rebind
      // the servercallhandler function so that it immediately uses that.
      const client = this.socket.clientServer.client.instance;

      try {
        const response = await process(client, data);
        if (response) respond(response);
      } catch (e) {
        console.error(
          `An error was caught that would have crashed the system if allowed through`
        );
        console.error(`======`);
        console.error(e);
        console.error(`======`);
      }

      // TODO: optimise this so that ClientCallHandler.prototype[name] gets rebound after the initial process() lookup?
    };
  });

  ClientCallHandler.api = serverFn;

  return ClientCallHandler;
}
