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
  let count = 3;
  console.log(`index> building ${count} clients`);
  (function generateClient() {
    if (count--) {
      ClientServer.createClient(serverURL);
      return setTimeout(generateClient, 1000);
    }

    // Plus one special browser-proxying client
    let webclient = ClientServer.createWebClient(
      serverURL,
      `${__dirname}/public`
    );

    webclient.listen(0, () =>
      console.log(
        `web client listening on http://localhost:${webclient.address().port}`
      )
    );
  })();
});
