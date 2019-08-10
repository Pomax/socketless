// How many clients to we want to test for?
const TOTAL_CLIENTS = 5;

// Build our ClientServer object:
const { generateClientServer } = require("socketless");
const ClientClass = require("./Client.js");
const ServerClass = require("./Server.js");
const ClientServer = generateClientServer(ClientClass, ServerClass);

// Set up the server:
const server = ClientServer.createServer();

// (and start it)
server.listen(0, () => {
  const port = server.address().port;
  const serverURL = `http://localhost:${port}`;
  console.log(`index> server listening on ${port}`);

  // And once the server is up, create a few clients:
  let clientCount = TOTAL_CLIENTS;

  console.log(`index> building ${clientCount} plain clients and 1 web client`);

  (function generateClient() {
    // Generate as many regular clients as necessary.
    if (clientCount--) {
      ClientServer.createClient(serverURL);
      return setTimeout(generateClient, 1000);
    }
  })();
});
