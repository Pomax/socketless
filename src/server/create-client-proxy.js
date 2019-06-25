module.exports = function(clientServer, namespaces) {
  // ... docs go here ...

  return socket => {
    const clientAPIs = {};

    namespaces.forEach(namespace => {
      clientAPIs[namespace] = new clientServer.server[namespace].client(socket);
    });

    clientAPIs.disconnect = function() {
      socket.disconnect(true);
    };

    clientAPIs.onDisconnect = function(handler) {
      socket.on("disconnect", data => handler(data));
    };

    return clientAPIs;
  };
};
