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
        // console.log(`server got a client: quitting`);
        this.doneOnQuit = doneOnQuit;
        this.quit();
      }
      teardown() {
        // console.log(`server: doneOnQuit=${doneOnQuit}`);
        if (this.doneOnQuit) {
          done();
        }
      }
    }

    class ClientClass {
      onDisconnect() {
        // console.log(`client saw disconnect, doneOnQuit=${doneOnQuit}`);
        if (doneOnQuit) return;
        const { webserver } = factory.createServer();
        webserver.listen(8910, () => {
          // console.log(`server up 2`);
          doneOnQuit = true;
          setTimeout(() => this.reconnect(), 200);
        });
      }
    }

    const factory = linkClasses(ClientClass, ServerClass);
    const { webserver } = factory.createServer();
    webserver.listen(8910, () => {
      // console.log(`server up 1`);
      factory.createClient(`http://localhost:8910`);
    });
  });

  it("client will wait for server to come online", (done) => {
    class ServerClass {
      onConnect(client) {
        this.quit();
      }
      teardown() {
        done();
      }
    }

    class ClientClass {
      #reconnection;
      constructor() {
        const tryConnect = () => {
          this.reconnect();
          this.#reconnection = setTimeout(tryConnect, 100);
        };
        setTimeout(tryConnect, 100);
      }
      onConnect() {
        clearTimeout(this.#reconnection);
      }
    }
    const factory = linkClasses(ClientClass, ServerClass);
    // create a client first
    factory.createClient(`http://localhost:8910`);

    // then start the server 500ms later
    setTimeout(() => {
      const { webserver } = factory.createServer();
      webserver.listen(8910);
    }, 500);
  });
});
