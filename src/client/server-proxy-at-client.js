const upgradeSocket = require("../upgrade-socket");

module.exports = function(namespace, serverFn) {
  // Define the server representation that the client can
  // use to talk to the server as if it was a local object.

  function ServerProxyAtClient(socketToServer) {
    this.socket = upgradeSocket(socketToServer);
  }

  ServerProxyAtClient.prototype = {};

  serverFn.forEach(name => {
    ServerProxyAtClient.prototype[name] = async function(data) {
      return await this.socket.upgraded.send(`${namespace}:${name}`, data);
    };
  });

  ServerProxyAtClient.api = serverFn;

  return ServerProxyAtClient;
};
