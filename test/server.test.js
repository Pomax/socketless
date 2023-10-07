import { generateClientServer, ClientBase, ServerBase } from "../src/index.js";

test("server supports all publically documented properties and functions", (done) => {
  class ClientClass extends ClientBase {
    async "test:remote"() {}
  }

  class ServerClass extends ServerBase {
    onConnect(client) {
      expect(this.clients).toBeDefined();
      expect(this.clients).toBeInstanceOf(Array);
      expect(this.clients).toHaveLength(1);

      expect(client).toHaveProperty(`test.remote`);
      expect(client).toHaveProperty(`disconnect`);
      client.disconnect();
    }

    onDisconnect(client) {
      this.quit();
    }

    onQuit() {
      done();
    }
  }

  const ClientServer = generateClientServer(ClientClass, ServerClass);
  const server = ClientServer.createServer();
  server.listen(0, () => {
    ClientServer.createClient(`http://localhost:${server.address().port}`);
  });
});
