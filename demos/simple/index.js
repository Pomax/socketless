/**
 * ...
 */
const ClientClass = require("./ClientClass.js");
const ServerClass = require("./ServerClass.js");

/**
 * ...
 */
const { generateClientServer } = require(`socketless`);
const factory = generateClientServer(ClientClass, ServerClass);

/**
 * ...
 */
const server = factory.createServer();
server.listen(8000, () => {
  [...new Array(4)].forEach(() =>
    factory.createClient("http://localhost:8000")
  );
});
