const { generateClientServer } = require("../../src/generate-client-server.js");
const ClientClass = require("./src/client/game-client.js");
const ServerClass = require("./src/server/game-server.js");
const ClientServer = generateClientServer(ClientClass, ServerClass);

const server = ClientServer.createServer();

server.listen(8080, () => {
  console.log(`index> server listening on http://localhost:8080`);
});
