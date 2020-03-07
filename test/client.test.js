const { generateClientServer } = require("../src/generate-client-server.js");

test("client supports all publically documented properties and functions", async () => {
  await new Promise(resolve => {
    class CMaster {
      async "test:receive"(msg) {
        expect(msg).toBe(`test`);
      }
    }

    class ClientClass extends CMaster {
      async onConnect() {
        expect(this.server).toBeDefined();
        expect(this.server).toHaveProperty(`test.remote`);

        expect(this.server).toHaveProperty(`broadcast`);
        await this.server.broadcast(this[`test:receive`], `test`);

        expect(this.server).toHaveProperty(`disconnect`);
        this.server.disconnect();
      }

      async "test:receive"(msg) {
        super["test:receive"](msg);
      }
    }

    class ServerClass {
      onDisconnect(client) {
        this.quit();
      }
      onQuit() {
        resolve();
      }

      async "test:remote"(client) {}
    }

    const ClientServer = generateClientServer(ClientClass, ServerClass);
    const server = ClientServer.createServer();
    server.listen(0, () => {
      ClientServer.createClient(`http://localhost:${server.address().port}`);
    });
  });
});
