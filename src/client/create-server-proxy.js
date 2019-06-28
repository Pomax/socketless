module.exports = function(clientServer, namespaces) {
  // ... docs go here ...

  return (socket, handler) => {
    const serverProxy = {};

    namespaces.forEach(namespace => {
      let clientAPI = clientServer.client[namespace];
      new clientAPI.handler(socket, handler);
      Object.defineProperty(serverProxy, namespace, {
        configurable: false,
        writable: false,
        value: new clientAPI.server(socket)
      });
    });

    serverProxy.disconnect = function() {
      socket.disconnect(true);
    };

    serverProxy.onDisconnect = function(handler) {
      socket.on("disconnect", data => handler(data));
    };

    serverProxy.broadcast = function(functionref, data) {
      let fname = functionref.name.replace(/\$/g, `:`);
      let evtname = `broadcast:${fname}`;
      socket.emit(evtname, data);
    };

    return serverProxy;
  };
};
