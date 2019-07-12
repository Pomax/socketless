const { generateClientServer } = require("../../src/generate-client-server.js");
const ClientClass = require("./src/core/game-client.js");
const ServerClass = require("./src/core/game-server.js");
const ClientServer = generateClientServer(ClientClass, ServerClass);

const server = ClientServer.createServer();
server.listen(8080, () => {
  console.log(`index> server listening on http://localhost:8080`);
});

const url = `http://localhost:8080`;
const public = `${__dirname}/public`;
const createWebClient = (request, response) => {
  const host = request.headers.host.replace(/:\d+/g, '');
  const webclient = ClientServer.createWebClient(url, public);
  webclient.listen(0, () => {
    const clientURL = `http://${host}:${webclient.address().port}`;
    console.log(`web client listening on ${clientURL}`);
    response.writeHead(200, { "Content-Type": "text/html" });
    return response.end(
      `<doctype html><meta http-equiv="refresh" content="0;URL='${clientURL}'">`,
      `utf-8`
    );
  });
};

const http = require("http");
const webserver = http.createServer((request, response) => {
  if (request.url === `/create`) createWebClient(request, response);
  if (request.url === `/`) {
    response.writeHead(200, { "Content-Type": "text/html" });
    return response.end(
      `<doctype html><a target="_blank" href="/create">Let's do this</a>`,
      `utf-8`
    );
  }
});

webserver.listen(8000, () => {
  console.log(`server running on http://localhost:8000`);
});
