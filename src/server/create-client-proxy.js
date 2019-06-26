module.exports = function(clientServer, namespaces) {
  // ... docs go here ...

  return socket => {
    const clientProxy = {};

    namespaces.forEach(namespace => {
      clientProxy[namespace] = new clientServer.server[namespace].client(socket);
    });

    clientProxy.disconnect = function() {
      socket.disconnect(true);
    };

    clientProxy.onDisconnect = function(handler) {
      socket.on("disconnect", data => handler(data));
    };

    return clientProxy;
  };
};
