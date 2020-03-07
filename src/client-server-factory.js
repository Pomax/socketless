const build = require("./build.js");
const attach = require("./util/attach.js");

// TODO it would be nice to make the factory client and server private fields.

/**
 * ...docs go here
 */
class ClientServerFactory {
  constructor() {
    this.client = {};
    this.server = {};
  }

  /**
   * Create immutable, namespaced bindings for the client.
   * @param {*} namespace
   * @param {*} clientAPI
   * @param {*} serverAPI
   * @param {*} resolveWithoutNamespace
   */
  setClientNamespace(namespace, clientAPI, serverAPI, resolveWithoutNamespace) {
    const serverProxy = build.serverProxyAtClient(namespace, serverAPI);
    const serverCallHandler = build.serverCallHandler(
      namespace,
      clientAPI,
      resolveWithoutNamespace
    );
    const namespaceObj = {};
    attach(namespaceObj, `server`, serverProxy);
    attach(namespaceObj, `handler`, serverCallHandler);
    attach(this.client, namespace, namespaceObj);
  }

  /**
   * Create immutable, namespaced bindings for the server.
   * @param {*} namespace
   * @param {*} clientAPI
   * @param {*} serverAPI
   * @param {*} resolveWithoutNamespace
   */
  setServerNamespace(namespace, clientAPI, serverAPI, resolveWithoutNamespace) {
    const clientProxy = build.clientProxyAtServer(namespace, clientAPI);
    const clientCallHandler = build.clientCallHandler(
      namespace,
      serverAPI,
      resolveWithoutNamespace
    );
    const namespaceObj = {};
    attach(namespaceObj, `client`, clientProxy);
    attach(namespaceObj, `handler`, clientCallHandler);
    attach(this.server, namespace, namespaceObj);
  }

  /**
   * Create and immutably bind the "create..." functions
   */
  finalise(namespaces, ClientClass, ServerClass, API) {
    attach(
      this,
      "createServer",
      /**
       * This function allows people to setup a web+socket server
       * without having to ever explicitly write websocket code.
       */
      build.createServer(this, namespaces, ServerClass, API)
    );

    attach(
      this.client,
      "createServer",
      /**
       * This function creates a server-proxy object that clients
       * can make direct calls against as if the server were a
       * locally accessible resource.
       */
      build.createServerProxy(this, namespaces)
    );

    attach(
      this,
      "createClient",
      /**
       * This allows people to setup a socket client without
       * having to ever explicitly write websocket code.
       */
      build.createClient(this, ClientClass)
    );

    attach(
      this.server,
      "createClient",
      /**
       * This function creates a client-proxy object that servers
       * can make direct calls against as if the client were a
       * locally accessible resource.
       */
      build.createClientProxy(this, namespaces)
    );

    attach(
      this,
      "createWebClient",
      /**
       * This function allows people to socket client that runs
       * its own web+socket server for attaching a browser to,
       * without having to ever explicitly write websocket code.
       */
      build.createWebClient(this, ClientClass, API)
    );
  }
}

module.exports = ClientServerFactory;
