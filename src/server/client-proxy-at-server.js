import { upgradeSocket } from "../util/upgrade-socket.js";

export function createClientProxyAtServer(namespace, clientFn) {
  // Define the client representation that the server can
  // use to talk to a client as if it was a local object.

  function ClientProxyAtServer(socketFromServer) {
    this.socket = upgradeSocket(socketFromServer);
  }

  ClientProxyAtServer.prototype = {};

  clientFn.forEach((name) => {
    ClientProxyAtServer.prototype[name] = async function (data) {
      return await this.socket.upgraded.send(`${namespace}:${name}`, data);
    };
  });

  ClientProxyAtServer.api = clientFn;

  return ClientProxyAtServer;
}
