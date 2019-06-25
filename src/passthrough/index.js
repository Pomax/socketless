
    // FIXME: TODO: really rethink this one...
    mapped.proxy = {
        create: (serverURL, serverFunctions, clientFunctions) => {
            // Connect to the server
            const socketToServer = require(`socket.io-client`)(serverURL);
            const server = API.createServer(socketToServer, handler);
            server.onDisconnect(() => console.log(`proxy ${this.id} disconnected from server.`));

            // Start our own server to accept a single client
            const webserver = require("http").Server();
            const io = require("socket.io")(webserver);
            let client = false;
            io.on(`connection`, socketToClient => {
                client = API.createClient(socketToClient);
                Object.keys(API).forEach(namespace => {
                    API[namespace].server.forEach(fname => {
                        let original = serverFunctions[fname];
                        serverFunctions[fname] = async function(...data) {
                            original(...data);
                            return await server[namespace][fname](...data);
                        };
                    });
                });
                Object.keys(API).forEach(namespace => {
                    new mapped.server[namespace].handler(socketToClient, serverFunctions); // handle "server calls" by the client
                });
                client.onDisconnect(() => {
                    if (serverFunctions.onDisconnect) serverFunctions.onDisconnect(socketToClient);
                });
            });
        }
    };