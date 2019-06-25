module.exports = function(clientServer, namespaces) {
  /**
   * This function ensures that, once there's a socketio server
   * instance to work with, that instance gets event binding set
   * up for all the functions in the server API.
   */
  return function(handler, io, onConnect) {
    io.on(`connection`, socket => {
      namespaces.forEach(namespace => {
        new clientServer.server[namespace].handler(socket, handler);
      });
      onConnect(socket);
    });
  };
};
