// First, bootstrap the ClientServer object:
const { generateClientServer } = require("socketless");
const ClientServer = generateClientServer(
  require("./src/core/client.js"),
  require("./src/core/server.js")
);

// Then use that to create a web client:
const url = `http://localhost:8080`;
const public = `${__dirname}/public`;
const webclient = ClientServer.createWebClient(url, public);

// And start the web client's web server, so a user can connect their browser to it.
webclient.listen(0, () => {
  console.log(`web client listening on ${webclient.address().port}`);
});
