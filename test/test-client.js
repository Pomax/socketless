// First, turn the API into a ClientServer object
const { generateClientServer } = require("../src/generate-client-server.js");
const ClientClass = require("../demo/Client.js");
const ServerClass = require("../demo/Server.js");
const ClientServer = generateClientServer(ClientClass, ServerClass);

// Then create a client, using the ClientServer object
// and a handler class for the client's side of the API:
ClientServer.createClient(`http://localhost:8080`);
