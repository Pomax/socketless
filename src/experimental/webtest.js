import url from "url";
const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

import { setDEBUG } from "./src/logger.js";
setDEBUG(false);

/**
 * ...
 */
class ClientClass {
  onConnect() {
    setInterval(
      () =>
        this.setState({
          randomValue: Math.random(),
        }),
      3000
    );
  }
}

/**
 * ...
 */
class ServerClass {
  async onConnect(client) {
    console.log(`client registered at server`);
  }
  async onDisconnect(client) {
    if (this.clients.length === 0) {
      this.quit();
    }
  }
  async test(client, a, b, c) {
    console.log(`test at server:`, a, b, c);
    return `${c}${b}${a}`;
  }
}

import { generateClientServer } from "./src/factory.js";
const factory = generateClientServer(ClientClass, ServerClass);
const server = factory.createServer();

// Create the main server
server.listen(0, () => {
  const PORT = server.address().port;
  const url = `http://localhost:${PORT}`;
  console.log(`test server running on ${url}`);

  // Create a webclient, which creates a real client as well as
  // a web server so your browser can connect to something.
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
