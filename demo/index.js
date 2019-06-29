// Change this value to change the number of clients that will be connected.
let clientCount = 3;

// Change this value to change whether or not a web client is connect in addition.
let addWebClient = true;

// Build our ClientServer object:
const { generateClientServer } = require("../src/generate-client-server.js");
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
  console.log(`index> building ${clientCount} plain clients and 1 web client`);
  (function generateClient() {
    // Generate as many regular clients as necessary...
    if (clientCount--) {
      ClientServer.createClient(serverURL);
      return setTimeout(generateClient, 1000);
    }

    if (addWebClient) {
      // And add a browser-proxying client afterwards.
      const createWebClient = ClientServer.createWebClient;
      let webclient = createWebClient(serverURL, `${__dirname}/public`);
      webclient.listen(0, () =>
        console.log(
          `\nweb client listening on http://localhost:${
            webclient.address().port
          }\n`
        )
      );
    }
  })();
});
