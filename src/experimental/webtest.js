import { setDEBUG } from "./src/logger.js";
setDEBUG(false);

import url from "url";
const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

class ClientClass {
  testStateUpdate(value) {
    this.setState({ testValue: value });
  }
}

class ServerClass {
  async onConnect(client) {
    client.testStateUpdate(888);
  }

  async test(client, a, b, c) {
    console.log(`test at server:`, a, b, c);
    return `${c}${b}${a}`;
  }
}

import { generateClientServer } from "./src/factory.js";
const factory = generateClientServer(ClientClass, ServerClass);
const server = factory.createServer();

server.listen(0, () => {
  const PORT = server.address().port;
  const url = `http://localhost:${PORT}`;
  console.log(`test server running on ${url}`);

  // create a webclient
  const clientWebServer = factory.createWebClient(url, `${__dirname}/public`);

  clientWebServer.addRoute(`/quit`, function (client, request, response) {
    console.log(
      `web client called /quit on client, calling client.disconnect() to disconnect from server.`
    );
    client.disconnect();
    response.write("client disconnected");
    response.end();
    console.log(`shutting down client web server`);
    clientWebServer.close();
  });

  clientWebServer.listen(50000, () => {
    const PORT = clientWebServer.address().port;
    const url = `http://localhost:${PORT}`;
    console.log(`web client running on ${url}`);
  });
});
