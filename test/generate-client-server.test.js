const { generateClientServer } = require("../src/generate-client-server.js");

test("can build clientserver", async () => {
  class ClientClass {
    async "admin:register"(id) {
      this.id = id;
      this.server.disconnect();
    }
  }

  class ServerClass {
    onConnect(client) {
      client.id = this.clients.length;
      client.admin.register(client.id);
    }
    onDisconnect() {
      this.__webserver.close(this.__webserver.__close);
    }
  }

  const ClientServer = generateClientServer(ClientClass, ServerClass);
  expect(ClientServer).toBeDefined();

  const server = ClientServer.createServer();
  expect(server).toBeDefined();

  await new Promise(resolve => {
    server.__close = resolve;
    server.listen(0, () => {
      const client = ClientServer.createClient(`http://localhost:${server.address().port}`);
      expect(client).toBeDefined();
    });
  });
});
