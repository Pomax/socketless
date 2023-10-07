import { generateClientServer, ClientBase, ServerBase } from "../src/index.js";

test("can build clientserver", (done) => {
  class ClientClass extends ClientBase {
    async "admin:register"(id) {
      this.id = id;
      this.server.disconnect();
    }
  }

  class ServerClass extends ServerBase {
    onConnect(client) {
      client.admin.register(client.id);
    }
    onDisconnect(client) {
      this.quit();
    }
    onQuit() {
      done();
    }
  }

  const ClientServer = generateClientServer(ClientClass, ServerClass);
  expect(ClientServer).toBeDefined();

  const server = ClientServer.createServer();
  expect(server).toBeDefined();

  server.listen(0, () => {
    const client = ClientServer.createClient(
      `http://localhost:${server.address().port}`
    );
    expect(client).toBeDefined();
  });
});
