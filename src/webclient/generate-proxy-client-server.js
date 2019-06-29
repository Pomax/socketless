/**
 * This function is converted to a string, wholesale, and
 * sent over to the browser, where it will be executed.
 *
 * This code does _not_ run anywhere except in the browser,
 * as part of a webclient `createClientServer()` call.
 */
function generateClientServer(WebClientClass) {
  const socketToClient = exports.io(window.location.toString());
  const socket = upgradeSocket(socketToClient);
  const proxyServer = {};

  // Add the browser => client => server forwarding
  namespaces.forEach(namespace => {
    proxyServer[namespace] = {};
    API[namespace].server.forEach(fname => {
      let evt = namespace + ":" + fname;
      proxyServer[namespace][fname] = async function(data) {
        return await socket.emit(evt, data);
      };
    });
  });

  const handler = new WebClientClass();

  // ensure that bootstrap instructions are processed
  socket.on(`bootstrap:self`, data => {
    Object.keys(data).forEach(key => (handler[key]= data[key]));
    if (handler.updated) { handler.updated(data); }
  });

  // Add the server => client => browser forwarding
  namespaces.forEach(namespace => {
    API[namespace].client.forEach(fname => {
      let evt = namespace + ":" + fname;
      let process = handler[evt];
      if (!process) process = handler[evt.replace(":", "$")];
      if (!process) throw new Error(`Browser class does not implement ${evt}`);
      socket.on(evt, async(data, respond) => {
        let response = await process.bind(handler)(data);
        respond(response);
      });
    });
  });

  // dedicated .quit() function so browsers can effect a disconnect
  proxyServer.quit = () => socket.emit("quit", {});

  return {
    client: handler,
    server: proxyServer
  };
}

module.exports = generateClientServer;
