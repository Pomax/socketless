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
        // try to call protected server functions
        try {
          await this.server.teardown();
        } catch (e) {
          console.log(`definitely throws`);
          expect(e).toBeDefined();
        }

        expect(async () => {
          console.log(`this, Jest claims, does not`);
          await this.server.teardown();
        }).toThrow();

        this.disconnect();
      }
    }

    class ServerClass {
      async onDisconnect() {
        if (!this.clients.length) {
          this.quit();
        }
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
