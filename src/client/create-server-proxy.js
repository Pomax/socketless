module.exports = function(clientServer, namespaces) {
  // ... docs go here ...

  return (socket, handler) => {
    const serverProxy = {};

    namespaces.forEach(namespace => {
      let clientAPI = clientServer.client[namespace];
      new clientAPI.handler(socket, handler);
      serverProxy[namespace] = new clientAPI.server(socket);
    });

    serverProxy.disconnect = function() {
      socket.disconnect(true);
    };

    serverProxy.onDisconnect = function(handler) {
      socket.on("disconnect", data => handler(data));
    };

    return serverProxy;
  };
};
