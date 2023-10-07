import { generateClientServer, ClientBase, ServerBase } from "../src/index.js";

test("client supports all publicly documented properties and functions", (done) => {
  class CMaster extends ClientBase {
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

  class ServerClass extends ServerBase {
    onDisconnect(client) {
      this.quit();
    }

    onQuit() {
      done();
    }

    async "test:remote"(client) {}
  }

  const ClientServer = generateClientServer(ClientClass, ServerClass);
  const server = ClientServer.createServer();
  server.listen(0, () => {
    ClientServer.createClient(`http://localhost:${server.address().port}`);
  });
});
