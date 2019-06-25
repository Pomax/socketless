const upgradeSocket = require("../upgrade-socket");

module.exports = function(namespace, serverFn) {
  // Define the handler object that the server can use to respond to
  // messages initiated by the client. (although responses may not be
  // required on a per-message basis).
  //
  // This is effectively the "true callable server API".

  function ClientCallHandler(socketFromClient, handler) {
    let socket = (this.socket = upgradeSocket(socketFromClient));
    this.handler = handler;
    serverFn.forEach(name => {
      socket.on(`${namespace}:${name}`, (data, respond) =>
        this[name](data, respond)
      );
    });
  }

  ClientCallHandler.prototype = {};

  serverFn.forEach(name => {
    ClientCallHandler.prototype[name] = async function(data, respond) {
      let process = this.handler[name].bind(this.handler);

      if (!process) {
        throw new Error(`Missing handler.${name} in ClientCallHandler.${name}`);
      }

      if (process.constructor.name !== "AsyncFunction") {
        throw new Error(
          `Missing 'async' keyword for handler.${name} in ClientCallHandler.${name}`
        );
      }

      let response = await process(data);
      if (response) respond(response);
    };
  });

  ClientCallHandler.api = serverFn;

  return ClientCallHandler;
};
