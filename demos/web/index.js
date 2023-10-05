import path from "path";
import url from "url";
import { ClientClass } from "./ClientClass.js";
import { ServerClass } from "./ServerClass.js";
import { generateClientServer } from "socketless";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const factory = generateClientServer(ClientClass, ServerClass);
const server = factory.createServer();

server.listen(8000, () => {
  const localhost = `http://localhost`;
  const URL = `${localhost}:${server.address().port}`;
  console.log(`\n    server listening on ${URL}\n`);

  for (let player = 1; player <= 2; player++) {
    const webclient = factory.createWebClient(
      URL,
      path.join(__dirname, `public`),
    );
    webclient.listen(8000 + player, () => {
      console.log(`\n    web client ${player} connected to server at ${URL}`);
      console.log(
        `    web client ${player} listening on ${localhost}:${
          webclient.address().port
        }`,
      );
      if (player === 2) console.log();
    });
  }
});

server.on(`close`, () => process.exit(0));
