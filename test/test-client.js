// First, turn the API into a ClientServer object
const API = require("../demo/API.js");
const { generateClientServer } = require("../src/generate-client-server.js");
const ClientServer = generateClientServer(API);

// Then create a client, using the ClientServer object
// and a handler class for the client's side of the API:
const ClientClass = require("../demo/Client.js");
ClientServer.createClient(`http://localhost:8080`, ClientClass);
