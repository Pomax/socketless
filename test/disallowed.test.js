import { linkClasses } from "../library.js";
import url from "url";
const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

/**
 * ...
 * @param {*} ClientClass
 * @param {*} __done
 */
function clientTest(ClientClass, __done) {
  let done;

  class ServerClass {
    constructor() {
      done = (...args) => {
        this.quit();
        __done(...args);
      };
    }
  }

  const factory = linkClasses(ClientClass, ServerClass);
  const { webserver } = factory.createServer();
  webserver.listen(0, () => {
    const serverURL = `http://localhost:${webserver.address().port}`;
    const client = factory.createClient(serverURL);
    client.done = done;
  });
}

/**
 * ...
 * @param {*} ServerClass
 * @param {*} __done
 */
function serverTest(ServerClass, __done, WEB_TEST = false) {
  class ClientClass {
    onConnect() {
      this.setState({
        test: () => console.error(`test`),
      });
    }
  }

  let client;

  class Wrapper extends ServerClass {
    constructor() {
      super();
      this.done = (...args) => {
        client?.quit();
        this.quit();
        __done(...args);
      };
    }
  }

  const factory = linkClasses(ClientClass, Wrapper);
  const { webserver } = factory.createServer();
  webserver.listen(0, () => {
    const serverURL = `http://localhost:${webserver.address().port}`;
    if (WEB_TEST) {
      const web = factory.createWebClient(
        serverURL,
        `${__dirname}/webclient/basic`,
      );
      client = web.client;
      web.clientWebServer.listen(0);
    } else {
      factory.createClient(serverURL);
    }
  });
}

/**
 * ...
 * @param {*} ServerClass
 * @param {*} __done
 */
function serverWebTest(ServerClass, __done) {
  serverTest(ServerClass, __done, true);
}

describe("illegal access tests", () => {
  /**
   * ...
   */
  describe("client to server ", () => {
    it("client cannot call server.onConnect", (done) => {
      class ClientClass {
        async onConnect() {
          try {
            await this.server.onConnect();
            return this.done(
              new Error(`Client was able to call server.onConnect function`),
            );
          } catch (e) {
            if (
              e.message !== `Illegal call: onConnect is a protected property`
            ) {
              return this.done(
                new Error(`received incorrect error message "${e.message}"`),
              );
            }
            this.done();
          }
        }
      }
      clientTest(ClientClass, done);
    });

    it("client cannot call server.addDisconnectHandling", (done) => {
      class ClientClass {
        async onConnect() {
          try {
            await this.server.addDisconnectHandling();
            return this.done(
              new Error(
                `Client was able to call server.addDisconnectHandling function`,
              ),
            );
          } catch (e) {
            if (
              e.message !==
              `Illegal call: addDisconnectHandling is a protected property`
            ) {
              return this.done(
                new Error(`received incorrect error message "${e.message}"`),
              );
            }
          }
          this.done();
        }
      }
      clientTest(ClientClass, done);
    });

    it("client cannot call server.onDisconnect", (done) => {
      class ClientClass {
        async onConnect() {
          try {
            await this.server.onDisconnect();
            return this.done(
              new Error(`Client was able to call server.onDisconnect function`),
            );
          } catch (e) {
            if (
              e.message !== `Illegal call: onDisconnect is a protected property`
            ) {
              return this.done(
                new Error(`received incorrect error message "${e.message}"`),
              );
            }
          }
          this.done();
        }
      }
      clientTest(ClientClass, done);
    });

    it("client cannot call server.quit", (done) => {
      class ClientClass {
        async onConnect() {
          try {
            await this.server.quit();
            return this.done(
              new Error(`Client was able to call server.quit function`),
            );
          } catch (e) {
            if (e.message !== `Illegal call: quit is a protected property`) {
              return this.done(
                new Error(`received incorrect error message "${e.message}"`),
              );
            }
          }
          this.done();
        }
      }
      clientTest(ClientClass, done);
    });

    it("client cannot call server.onQuit", (done) => {
      class ClientClass {
        async onConnect() {
          try {
            await this.server.onQuit();
            return this.done(
              new Error(`Client was able to call server.onQuit function`),
            );
          } catch (e) {
            if (e.message !== `Illegal call: onQuit is a protected property`) {
              return this.done(
                new Error(`received incorrect error message "${e.message}"`),
              );
            }
          }
          this.done();
        }
      }
      clientTest(ClientClass, done);
    });

    it("client cannot call server.teardown", (done) => {
      class ClientClass {
        async onConnect() {
          try {
            await this.server.teardown();
            return this.done(
              new Error(`Client was able to call server.teardown function`),
            );
          } catch (e) {
            if (
              e.message !== `Illegal call: teardown is a protected property`
            ) {
              return this.done(
                new Error(`received incorrect error message "${e.message}"`),
              );
            }
          }
          this.done();
        }
      }
      clientTest(ClientClass, done);
    });

    it("client cannot call server.clients.map", (done) => {
      class ClientClass {
        async onConnect() {
          try {
            await this.server.clients.map();
            return this.done(
              new Error(`Client was able to call server.clients.map function`),
            );
          } catch (e) {
            if (e.message !== `Illegal call: clients is a protected property`) {
              return this.done(
                new Error(`received incorrect error message "${e.message}"`),
              );
            }
          }
          this.done();
        }
      }
      clientTest(ClientClass, done);
    });

    it("client cannot call server.ws.close", (done) => {
      class ClientClass {
        async onConnect() {
          try {
            await this.server.ws.close();
            return this.done(
              new Error(`Client was able to call server.ws.close function`),
            );
          } catch (e) {
            if (e.message !== `Illegal call: ws is a protected property`) {
              return this.done(
                new Error(`received incorrect error message "${e.message}"`),
              );
            }
          }
          this.done();
        }
      }
      clientTest(ClientClass, done);
    });

    it("client cannot call server.webserver.close", (done) => {
      class ClientClass {
        async onConnect() {
          try {
            await this.server.webserver.close();
            return this.done(
              new Error(
                `Client was able to call server.webserver.close function`,
              ),
            );
          } catch (e) {
            if (
              e.message !== `Illegal call: webserver is a protected property`
            ) {
              return this.done(
                new Error(`received incorrect error message "${e.message}"`),
              );
            }
          }
          this.done();
        }
      }
      clientTest(ClientClass, done);
    });
  });

  /**
   *
   */
  describe("server to client", () => {
    it("server cannot call client.onConnect", (done) => {
      class ServerClass {
        async onConnect(client) {
          try {
            await client.onConnect();
            return this.done(
              new Error(`Server was able to call client.onConnect function`),
            );
          } catch (e) {
            if (
              e.message !== `Illegal call: onConnect is a protected property`
            ) {
              return this.done(
                new Error(`received incorrect error message "${e.message}"`),
              );
            }
          }
          this.done();
        }
      }
      serverTest(ServerClass, done);
    });

    it("server cannot call client.onDisconnect", (done) => {
      class ServerClass {
        async onConnect(client) {
          try {
            await client.onDisconnect();
            return this.done(
              new Error(`Server was able to call client.onDisconnect function`),
            );
          } catch (e) {
            if (
              e.message !== `Illegal call: onDisconnect is a protected property`
            ) {
              return this.done(
                new Error(`received incorrect error message "${e.message}"`),
              );
            }
          }
          this.done();
        }
      }
      serverTest(ServerClass, done);
    });

    it("server cannot call client.setState", (done) => {
      class ServerClass {
        async onConnect(client) {
          try {
            await client.setState();
            return this.done(
              new Error(`Server was able to call client.setState function`),
            );
          } catch (e) {
            if (
              e.message !== `Illegal call: setState is a protected property`
            ) {
              return this.done(
                new Error(`received incorrect error message "${e.message}"`),
              );
            }
          }
          this.done();
        }
      }
      serverTest(ServerClass, done);
    });

    it("server cannot call client.connectServerSocket", (done) => {
      class ServerClass {
        async onConnect(client) {
          try {
            await client.connectServerSocket();
            return this.done(
              new Error(
                `Server was able to call client.connectServerSocket function`,
              ),
            );
          } catch (e) {
            if (
              e.message !==
              `Illegal call: connectServerSocket is a protected property`
            ) {
              return this.done(
                new Error(`received incorrect error message "${e.message}"`),
              );
            }
          }
          this.done();
        }
      }
      serverTest(ServerClass, done);
    });

    it("server cannot call client.state.test", (done) => {
      class ServerClass {
        async onConnect(client) {
          try {
            await client.state.test();
            return this.done(
              new Error(`Server was able to call client.state.test function`),
            );
          } catch (e) {
            if (e.message !== `Illegal call: state is a protected property`) {
              return this.done(
                new Error(`received incorrect error message "${e.message}"`),
              );
            }
          }
          this.done();
        }
      }
      serverTest(ServerClass, done);
    });
  });

  /**
   *
   */
  describe("server to webclient", () => {
    it("server cannot call webclient.connectBrowserSocket", (done) => {
      class ServerClass {
        async onConnect(client) {
          try {
            await client.connectBrowserSocket();
            return this.done(
              new Error(
                `Server was able to call webclient.connectBrowserSocket function`,
              ),
            );
          } catch (e) {
            if (
              e.message !==
              `Illegal call: connectBrowserSocket is a protected property`
            ) {
              return this.done(
                new Error(`received incorrect error message "${e.message}"`),
              );
            }
          }
          this.done();
        }
      }
      serverWebTest(ServerClass, done);
    });

    it("server cannot call webclient.disconnectBrowserSocket", (done) => {
      class ServerClass {
        async onConnect(client) {
          try {
            await client.disconnectBrowserSocket();
            return this.done(
              new Error(
                `Server was able to call webclient.disconnectBrowserSocket function`,
              ),
            );
          } catch (e) {
            if (
              e.message !==
              `Illegal call: disconnectBrowserSocket is a protected property`
            ) {
              return this.done(
                new Error(`received incorrect error message "${e.message}"`),
              );
            }
          }
          this.done();
        }
      }
      serverWebTest(ServerClass, done);
    });

    it("server cannot call webclient.onQuit", (done) => {
      class ServerClass {
        async onConnect(client) {
          try {
            await client.onQuit();
            return this.done(
              new Error(`Server was able to call webclient.onQuit function`),
            );
          } catch (e) {
            if (e.message !== `Illegal call: onQuit is a protected property`) {
              return this.done(
                new Error(`received incorrect error message "${e.message}"`),
              );
            }
          }
          this.done();
        }
      }
      serverWebTest(ServerClass, done);
    });

    it("server cannot call webclient.teardown", (done) => {
      class ServerClass {
        async onConnect(client) {
          try {
            await client.teardown();
            return this.done(
              new Error(`Server was able to call webclient.teardown function`),
            );
          } catch (e) {
            if (
              e.message !== `Illegal call: teardown is a protected property`
            ) {
              return this.done(
                new Error(`received incorrect error message "${e.message}"`),
              );
            }
          }
          this.done();
        }
      }
      serverWebTest(ServerClass, done);
    });

    it("server cannot call webclient.browser.update", (done) => {
      class ServerClass {
        async onConnect(client) {
          try {
            await client.browser.update();
            return this.done(
              new Error(
                `Server was able to call webclient.browser.update function`,
              ),
            );
          } catch (e) {
            if (e.message !== `Illegal call: browser is a protected property`) {
              return this.done(
                new Error(`received incorrect error message "${e.message}"`),
              );
            }
          }
          this.done();
        }
      }
      serverWebTest(ServerClass, done);
    });

    it("server cannot call webclient.ws.close", (done) => {
      class ServerClass {
        async onConnect(client) {
          try {
            await client.ws.close();
            return this.done(
              new Error(`Server was able to call webclient.ws.close function`),
            );
          } catch (e) {
            if (e.message !== `Illegal call: ws is a protected property`) {
              return this.done(
                new Error(`received incorrect error message "${e.message}"`),
              );
            }
          }
          this.done();
        }
      }
      serverWebTest(ServerClass, done);
    });

    it("server cannot call webclient.webserver.close", (done) => {
      class ServerClass {
        async onConnect(client) {
          try {
            await client.webserver.close();
            return this.done(
              new Error(
                `Server was able to call webclient.webserver.close function`,
              ),
            );
          } catch (e) {
            if (
              e.message !== `Illegal call: webserver is a protected property`
            ) {
              return this.done(
                new Error(`received incorrect error message "${e.message}"`),
              );
            }
          }
          this.done();
        }
      }
      serverWebTest(ServerClass, done);
    });
  });
});
