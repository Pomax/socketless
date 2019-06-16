// Build our API objects
const API = require('./API');
const buildAsyncFunctions = require('../src/buildAsyncFunctions');
const ClientServer = buildAsyncFunctions(API);

// Load the classes that will make use of these API objects
const Server = require('./Server');
const Client = require('./Client');

// Set up the server:
const webserver = require("http").Server();
const io = require("socket.io")(webserver);
new Server(io, ClientServer.server);

// (and start it)
webserver.listen(0, () => {
    const port = webserver.address().port;
    const serverURL = `http://localhost:${port}`;

    console.log(`index> pretend server listening on ${port}`);

    // Set up a client:
    const newClient = () => {
        const socketToServer = require(`socket.io-client`)(serverURL);
        new Client(socketToServer, ClientServer.client);
        setTimeout(next, 1000);
    };

    let count = 3;
    console.log(`index> building ${count} clients`);
    function next() { if(count--) newClient() }
    next();
});
