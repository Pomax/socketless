import path from "path";
import url from "url";
const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

import { ClientClass } from "./ClientClass.js";
import { ServerClass } from "./ServerClass.js";
import { linkClasses } from "socketless";
const factory = linkClasses(ClientClass, ServerClass);

// Set up the server:
const NUMBER_OF_PLAYERS = 2;
const server = factory.createServer();
server.listen(8000, () => {
  const localhost = `http://localhost`;
  const URL = `${localhost}:${server.address().port}`;
  console.log(`- server listening on ${URL}`);

  // Set up the clients:
  const clientURLs = [];
  const publicDir = path.join(__dirname, `public`);
  for (let player = 1; player <= NUMBER_OF_PLAYERS; player++) {
    const { client, clientWebServer } = factory.createWebClient(URL, publicDir);
    const port = 8000 + player;
    clientWebServer.listen(port, () => {
      console.log(`- web client ${player} listening on ${localhost}:${port}`);
    });
    clientURLs.push(`http://localhost:${port}`);
  }

  // And add a route handler so that when we connect to the server
  // with a browser, we get a list of web clients and their URLs.
  server.addRoute(
    `/`,
    // middleware: just a page request notifier
    (req, res, next) => {
      console.log(`index page requested`);
      next();
    },
    // serve HTML source for the list of connected clients
    (_, res) => {
      res.writeHead(200, { "Content-Type": `text/html` });
      res.end(
        `<doctype html><html><body><ol>${clientURLs
          .map((url) => `<li><a target="_blank" href="${url}">${url}</a></li>`)
          .join(``)}</ol></body></html>`,
      );
    },
  );
});
