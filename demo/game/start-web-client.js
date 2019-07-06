const { generateClientServer } = require("../../src/generate-client-server.js");
const ClientClass = require("./src/client/game-client.js");
const ServerClass = require("./src/server/game-server.js");
const ClientServer = generateClientServer(ClientClass, ServerClass);

const url = `http://localhost:8080`;
const public = `${__dirname}/public`;
const webclient = ClientServer.createWebClient(url, public);

webclient.listen(0, () => {
  const clientURL = `http://localhost:${webclient.address().port}`;
  console.log(`web client listening on ${clientURL}`);
});
