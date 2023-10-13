import { generateClientServer } from "../src/index.js";

describe("web client tests", () => {
  it("can run a basic client/server setup", (done) => {
    // A very simple client class.
    class ClientClass {
      onConnect = () => this.disconnect();
    }

    // And a very simple server class.
    class ServerClass {
      onDisconnect = () => (this.clients.length ? null : this.quit());
      teardown = () => done();
    }

    // Test the connection basics.
    const factory = generateClientServer(ClientClass, ServerClass);
    const server = factory.createServer();

    // First, stand up the server.
    server.listen(0, () => {
      // Then stand up a client.
      factory.createClient(`http://localhost:${server.address().port}`);
      // And of course the client will immediately disconnect after successfully connecting.
    });
    // Which will cause the server to shut down because it has no clients left.
  });

  it("disallows calling protected functions", (done) => {
    class ClientClass {
      async onConnect() {
        expect(async () => await this.server.onConnect()).rejects.toThrow();
        expect(async () => await this.server.onDisconnect()).rejects.toThrow();
        expect(async () => await this.server.onQuit()).rejects.toThrow();
        expect(async () => await this.server.teardown()).rejects.toThrow();
        expect(
          async () => await this.server.connectClientSocket(),
        ).rejects.toThrow();
        expect(
          async () => await this.server.addDisconnectHandling(),
        ).rejects.toThrow();
        expect(async () => await this.server.quit()).rejects.toThrow();

        this.server.runServerTests();
      }

      async finish() {
        this.disconnect();
      }
    }

    class ServerClass {
      async onDisconnect() {
        if (!this.clients.length) {
          this.quit();
        }
      }

      async runServerTests(client) {
        expect(async () => await client.setState("test")).rejects.toThrow();
        expect(
          async () => await client.connectServerSocket(),
        ).rejects.toThrow();
        client.finish();
      }

      async teardown() {
        console.log(`teardown?`);
        done();
      }
    }

    const factory = generateClientServer(ClientClass, ServerClass);
    const server = factory.createServer();
    server.listen(0, () => {
      factory.createClient(`http://localhost:${server.address().port}`);
    });
  });
});
