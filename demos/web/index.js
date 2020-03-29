const ClientClass = require("./ClientClass.js");
const ServerClass = require("./ServerClass.js");
const { generateClientServer } = require(`socketless`);
const factory = generateClientServer(ClientClass, ServerClass);

/**
 * ...
 */
const path = require("path");
const server = factory.createServer();
server.listen(8000, () => {
  const URL = `http://localhost:8000`;
  console.log(`\n    server listening on ${URL}\n`);

  // player 1
  const webclient1 = factory.createWebClient(URL, path.join(__dirname, `public`));
  const clientURL1 = `http://localhost:8001`;
  webclient1.listen(8001, () => {
    console.log(`\n    web client 1 connected to server at ${URL}`);
    console.log(`    web client 1 listening on ${clientURL1}\n`);
  });

  // player 2
  const webclient2 = factory.createWebClient(URL, path.join(__dirname, `public`));
  const clientURL2 = `http://localhost:8002`;
  webclient2.listen(8002, () => {
    console.log(`\n    web client 2 connected to server at ${URL}`);
    console.log(`    web client 2 listening on ${clientURL2}\n`);
  });
});
