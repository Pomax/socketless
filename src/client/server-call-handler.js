const upgradeSocket = require("../upgrade-socket");

module.exports = function(namespace, clientFn) {
  // Define the handler object that the client can use to respond to
  // messages initiated by the server. (although responses may not be
  // required on a per-message basis).
  //
  // This is effectively the "true callable client API".

  function ServerCallHandler(socketFromServer, handler) {
    let socket = (this.socket = upgradeSocket(socketFromServer));
    this.handler = handler;
    clientFn.forEach(name => {
      socket.on(`${namespace}:${name}`, (data, respond) =>
        this[name](data, respond)
      );
    });
  }

  ServerCallHandler.prototype = {};

  clientFn.forEach(name => {
    ServerCallHandler.prototype[name] = async function(data, respond) {
      let process = this.handler[name].bind(this.handler);

      if (!process) {
        throw new Error(`Missing handler.${name} in ServerCallHandler.${name}`);
      }

      if (process.constructor.name !== "AsyncFunction") {
        throw new Error(
          `Missing 'async' keyword for handler.${name} in ServerCallHandler.${name}`
        );
      }

      let response = await process(data);
      if (response) respond(response);
    };
  });

  ServerCallHandler.api = clientFn;

  return ServerCallHandler;
};
