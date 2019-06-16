const API = require('./API');
const buildAsyncFunctions = require('../src/buildAsyncFunctions');
const coms = buildAsyncFunctions(API);

const Server = require('./Server');
const Client = require('./Client');

const webserver = require("http").Server();
const io = require("socket.io")(webserver);
new Server(io, coms.user.server);

webserver.listen(0, () => {
    const port = webserver.address().port;
    const serverURL = `http://localhost:${port}`;

    console.log(`index> pretend server listening on ${port}`);

    let count = 3;
    const next = () => {
        if(count--) {
            const socketToServer = require(`socket.io-client`)(serverURL);
            new Client(socketToServer, coms.user.client);
            setTimeout(next, 1000);
        }
    }

    console.log(`index> building ${count} clients`);
    next();
});
