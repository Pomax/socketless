// Build our API objects:
const API = require("./API");
const generateClientServer = require("../src/generate-client-server.js");
const ClientServer = generateClientServer(API);

// And load the classes that will actually service API calls:
const ClientClass = require("./Client");
const ServerClass = require("./Server");

// Set up the server:
const server = ClientServer.createServer(ServerClass);

// (and start it)
server.listen(0, () => {
  const port = server.address().port;
  const serverURL = `http://localhost:${port}`;
  console.log(`index> server listening on ${port}`);

  // And once the server is up, create a few clients:

  let count = 3;
  console.log(`index> building ${count} clients`);

  (function next() {
    if (count--) {
      ClientServer.createClient(serverURL, ClientClass);
      setTimeout(next, 1000);
    }
  })();
});
