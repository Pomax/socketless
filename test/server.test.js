const { generateClientServer } = require("../src/generate-client-server.js");

test("server supports all publically documented properties and functions", async () => {
  await new Promise(resolve => {
    class ClientClass {
      async "test:remote"() {}
    }

    class ServerClass {
      onConnect(client) {
        expect(this.clients).toBeDefined();
        expect(this.clients).toBeInstanceOf(Array);
        expect(this.clients).toHaveLength(1);

        expect(client).toHaveProperty(`test.remote`);
        expect(client).toHaveProperty(`disconnect`);
        client.disconnect();
      }

      onDisconnect(client) {
        expect(this.quit).toBeDefined();
        this.quit();
      }

      onQuit() {
        resolve();
      }
    }

    const ClientServer = generateClientServer(ClientClass, ServerClass);
    const server = ClientServer.createServer();
    server.listen(0, () => {
      ClientServer.createClient(`http://localhost:${server.address().port}`);
    });
  });
});
