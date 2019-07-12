const { generateClientServer } = require("../../src/generate-client-server.js");
const ClientClass = require("./src/core/game-client.js");
const ServerClass = require("./src/core/game-server.js");
const ClientServer = generateClientServer(ClientClass, ServerClass);

// Code for the socket server
const server = ClientServer.createServer();
server.listen(8080, () => {
  console.log(`index> server listening on http://localhost:8080`);
});

// Code for creating a web client
const { spawn } = require('child_process');
const npm = `npm${process.platform === "win32" ? `.cmd` : ``}`;
const createWebClient = (request, response) => {
  const host = request.headers.host.replace(/:\d+/g, '');
  const clientProcess = spawn(npm, [`run`, `game:client`]);

  let run = data => {
    data = data.toString();
    console.log(data);

    if (data.indexOf(`web client listening on `) > -1) {
      const port = data.replace(`web client listening on `,``).trim();
      const clientURL = `http://${host}:${port}`;
      console.log(`web client process reported ${clientURL} as live URL`);
      response.writeHead(200, { "Content-Type": "text/html" });
      response.end(
        `<doctype html><meta http-equiv="refresh" content="0;URL='${clientURL}'">`,
        `utf-8`
      );
      // once we've done this, just start proxying stdout.
      run = console.log;
    }
  }

  clientProcess.stdout.on('data', data => run(data));
};

// Code for the server's "web server", which is really just a convenient
// place to point a browser to and then one-click create your client.
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

webserver.listen(8000, () => console.log(`server running on http://localhost:8000`));
