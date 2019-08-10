// First, bootstrap the ClientServer object:
const { generateClientServer } = require("socketless");
const ClientServer = generateClientServer(
  require("./src/core/client.js"),
  require("./src/core/server.js")
);

// Then create a server, and start it up.
const server = ClientServer.createServer();
server.listen(8080, () => {
  console.log(`index> game server listening on http://localhost:8080`);
});

// We want people to be able to connect to the server with their
// browser, so they can click a "join" button and have that create
// a client for them, and then redirect them to the client's url.
const createWebClient = require("./create-web-client.js");
const joinHTML = `<doctype html>
  <html>
    <meta charset="utf-8">
    <style>
    a {
      display: block;
      width: 5em;
      height: 1.25em;
      position: absolute;
      top: calc(50vh - 1.25em);
      left: calc(50vw - 2.5em);
      background: #90d796;
      border-radius: 0.25em;
      box-shadow: 4px 4px 10px -1px gray;
      font-family: verdana;
      font-size: 200%;
      text-decoration: none;
      text-align: center;
      color: white;
      text-shadow: 0 0 1px black;
    }
    </style>
    <a href="/create">Join</a>
  </html>
`;

// The route handler only knows how to service two routes: the base
// route, which serves the above HTML code, and the /create route,
// which creates a web client and moves users over to that.
const routeHandler = (request, response) => {
  if (request.url === `/create`) return createWebClient(request, response);
  if (request.url === `/`) {
    response.writeHead(200, { "Content-Type": "text/html" });
    return response.end(joinHTML);
  }
  response.writeHead(404);
  response.end("not found");
};

// So: create a simple http server and run it on port 8000.
const http = require("http");
const webserver = http.createServer(routeHandler);
webserver.listen(8000, () =>
  console.log(`index> primary web server running on http://localhost:8000`)
);
