// First, turn the API into a ClientServer object
const ClientClass = require("../simple/Client.js");
const ServerClass = require("../simple/Server.js");
const { generateClientServer } = require("socketless");
const ClientServer = generateClientServer(ClientClass, ServerClass);

// Then create a client, using the ClientServer object
// and a handler class for the client's side of the API:
ClientServer.createClient(`http://localhost:8080`);
