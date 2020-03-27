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
  const url = `http://localhost:8000`;
  console.log(`server listening on ${url}`);
  const webclient = factory.createWebClient(url, path.join(__dirname, `public`));
  webclient.listen(8001, () => {
    console.log(`web client listening on http://localhost:8001`);
  });
});
