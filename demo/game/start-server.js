const { generateClientServer } = require("../../src/generate-client-server.js");
const ClientClass = require("./game-client.js");
const ServerClass = require("./game-server.js");
const ClientServer = generateClientServer(ClientClass, ServerClass);

const server = ClientServer.createServer();

server.listen(8080, () => {
  console.log(`index> server listening on http://localhost:8080`);
});
