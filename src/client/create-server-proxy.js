module.exports = function(clientServer, namespaces) {
  // ... docs go here ...

  return (socket, handler) => {
    const serverAPIs = {};

    namespaces.forEach(namespace => {
      let clientAPI = clientServer.client[namespace];
      new clientAPI.handler(socket, handler);
      serverAPIs[namespace] = new clientAPI.server(socket);
    });

    serverAPIs.disconnect = function() {
      socket.disconnect(true);
    };
    serverAPIs.onDisconnect = function(handler) {
      socket.on("disconnect", data => handler(data));
    };

    return serverAPIs;
  };
};
