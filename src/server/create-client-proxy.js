module.exports = function(clientServer, namespaces) {
  // ... docs go here ...

  return socket => {
    const clientProxy = {};

    namespaces.forEach(namespace => {
      Object.defineProperty(clientProxy, namespace, {
        configurable: false,
        writable: false,
        value: new clientServer.server[namespace].client(socket)
      });
    });

    clientProxy.disconnect = function() {
      socket.close();
    };

    clientProxy.onDisconnect = function(handler) {
      socket.on(`close`, data => handler(data));
    };

    return clientProxy;
  };
};
