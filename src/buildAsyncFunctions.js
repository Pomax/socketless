const upgradeSocket = require("./upgrade-socket");

/**
 * Turn an API definition, like above, into an object with the four classes
 * required by the clients and server.
 * @param {*} API
 */
function buildAsyncFunctions(API) {
    const mapped = {};

    Object.keys(API).map(namespace => {

        // Define the server representation that the client can
        // use to talk to the server as if it was a local object.

        let serverFn = API[namespace].server;

        function ServerRepresentationAtClient(socketToServer) {
            this.socket = upgradeSocket(socketToServer);
        };

        ServerRepresentationAtClient.prototype = {
            disconnect: function() {
                this.socket.disconnect(true);
            },
            onDisconnect: function(handler) {
                this.socket.on('disconnect', data => handler(data));
            }
        };

        serverFn.forEach(name => {
            ServerRepresentationAtClient.prototype[name] = async function(data) {
                return await this.socket.emit(`${namespace}:${name}`, data);
            };
        });

        ServerRepresentationAtClient.api = serverFn;

        // Define the client representation that the server can
        // use to talk to a client as if it was a local object.

        let clientFn = API[namespace].client;

        function ClientRepresentationAtServer(socketFromServer) {
            this.socket = upgradeSocket(socketFromServer);
        }

        ClientRepresentationAtServer.prototype = {
            disconnect: function() {
                this.socket.disconnect(true);
            },
            onDisconnect: function(handler) {
                this.socket.on('disconnect', data => handler(data));
            }
        };

        clientFn.forEach(name => {
            ClientRepresentationAtServer.prototype[name] = async function(data) {
                return await this.socket.emit(`${namespace}:${name}`, data);
            };
        });

        ClientRepresentationAtServer.api = clientFn;

        // Define the handler object that the server can use to respond to
        // messages initiated by the client. (although responses may not be
        // required on a per-message basis).
        //
        // This is effectively the "true callable server API".

        function SocketFromClientAtServer(socketFromClient, handler) {
            let socket = this.socket = upgradeSocket(socketFromClient);
            this.handler = handler;
            serverFn.forEach(name => {
                socket.on(`${namespace}:${name}`, (data, respond) => this[name](data, respond));
            });
        };

        SocketFromClientAtServer.prototype = {};

        serverFn.forEach(name => {
            SocketFromClientAtServer.prototype[name] = async function(data, respond) {
                let process = this.handler[name].bind(this.handler);

                if (!process) {
                    throw new Error(`Missing handler.${name} in ServerRepresentation.${name}`);
                }

                if (process.constructor.name !== 'AsyncFunction') {
                    throw new Error(`Handler.${name} in ClientRepresentation.${name} was declared without 'async'`);
                }

                let response = await process(data);
                if (response) respond(response);
            };
        });

        SocketFromClientAtServer.api = serverFn;

        // Define the handler object that the client can use to respond to
        // messages initiated by the server. (although responses may not be
        // required on a per-message basis).
        //
        // This is effectively the "true callable client API".

        function SocketFromServerAtClient(socketFromServer, handler) {
            let socket = this.socket = upgradeSocket(socketFromServer);
            this.handler = handler;
            clientFn.forEach(name => {
                socket.on(`${namespace}:${name}`, (data, respond) => this[name](data, respond));
            });
        };

        SocketFromServerAtClient.prototype = {};

        clientFn.forEach(name => {
            SocketFromServerAtClient.prototype[name] = async function(data, respond) {
                let process = this.handler[name].bind(this.handler);

                if (!process) {
                    throw new Error(`Missing handler.${name} in ServerRepresentation.${name}`);
                }

                if (process.constructor.name !== 'AsyncFunction') {
                    throw new Error(`Handler.${name} in ClientRepresentation.${name} was declared without 'async'`);
                }

                let response = await process(data);
                if (response) respond(response);
            };
        });

        SocketFromServerAtClient.api = clientFn;


        // And then we bind these four classes into the
        // same namespace as we used in the API definition.

        mapped[namespace] = {
            client: {
                server: ServerRepresentationAtClient,
                handler: SocketFromServerAtClient
            },
            server: {
                client: ClientRepresentationAtServer,
                handler: SocketFromClientAtServer
            }
        };
    });

    return mapped;
}

module.exports = buildAsyncFunctions;
