// The port the web client UI will use. If this port is already in use
// on your computer, simply change it to some other value, or set it to
// the value 0 if you want the computer to pick a free port for you.
const WEB_CLIENT_PORT = 1234;

// How many clients to we want to test for?
const TOTAL_CLIENTS = 3;

// Build our ClientServer object:
const { generateClientServer } = require("socketless");
const ClientClass = require("../simple/Client.js");
const ServerClass = require("../simple/Server.js");
const ClientServer = generateClientServer(ClientClass, ServerClass);

// Set up the server:
const server = ClientServer.createServer();

// (and start it)
server.listen(0, () => {
  const port = server.address().port;
  const serverURL = `http://localhost:${port}`;
  console.log(`index> server listening on ${port}`);

  // Start the web client first, and have it create the
  // rest of the clients once that's up and running.
  startWebClient(serverURL);
});

// If web clients are necessary, this function can build them.
function startWebClient(serverURL) {
  const webclient = ClientServer.createWebClient(
    serverURL,
    `${__dirname}/public`,
    { directSync: true }
  );

  // note that we're using direct synchronisation, rather than
  // using the dedicated `state` object. This is generally not
  // a good idea, but if you really want to... you can.

  webclient.listen(WEB_CLIENT_PORT, () => {
    const clientURL = `http://localhost:${webclient.address().port}`;
    console.log(`\nweb client listening on ${clientURL}\n`);

    // Once the  web client is running, add in the rest of the clients,
    // so that the web client can see them joining.
    let clientCount = TOTAL_CLIENTS;

    function generateClient() {
      if (clientCount--) {
        ClientServer.createClient(serverURL);
        return setTimeout(generateClient, 1000);
      }
    };

    setTimeout(generateClient, 3000);
  });
}
