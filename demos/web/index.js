const ClientClass = require("./ClientClass.js");
const ServerClass = require("./ServerClass.js");
const { generateClientServer } = require(`socketless`);
const factory = generateClientServer(ClientClass, ServerClass);

// Start up our game server
const path = require("path");
const server = factory.createServer();
server.listen(8000, () => {
  const localhost = `http://localhost`;
  const URL = `${localhost}:${server.address().port}`;
  console.log(`\n    server listening on ${URL}\n`);

  for (let player=1; player<=2; player++) {
    const webclient = factory.createWebClient(URL, path.join(__dirname, `public`));
    webclient.listen(8000 + player, () => {
      console.log(`\n    web client ${player} connected to server at ${URL}`);
      console.log(`    web client ${player} listening on ${localhost}:${webclient.address().port}`);
      if (player===2) console.log();
    });
  }
});
