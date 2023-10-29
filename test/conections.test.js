import { linkClasses } from "../src/index.js";

function execute(command) {
  return new Promise((resolve, reject) => {
    exec(command, (e, out, err) => (e ? reject(err) : resolve(out)));
  });
}

describe("connection tests", () => {
  it("client can reconnect if server disappears", (done) => {
    let doneOnQuit = false;

    class ServerClass {
      onConnect(client) {
        this.quit();
      }
      teardown() {
        if (doneOnQuit) {
          done();
        }
      }
    }

    class ClientClass {
      onDisconnect() {
        if (doneOnQuit) return;
        const { webserver } = factory.createServer();
        doneOnQuit = true;
        webserver.listen(8910, () => {
          setTimeout(() => this.reconnect(), 200);
        });
      }
    }

    const factory = linkClasses(ClientClass, ServerClass);
    const { webserver } = factory.createServer();
    webserver.listen(8910, () => {
      factory.createClient(`http://localhost:8910`);
    });
  });
});
