import puppeteer from "puppeteer";
import { linkClasses, createClient, createServer } from "../src/index.js";
import url from "url";
const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
import {
  getBytesSent,
  resetBytesSent,
  toggleForcedSync,
  toggleTestFunctions,
} from "../src/upgraded-socket.js";
import { assert } from "chai";

toggleTestFunctions(true);

describe("basic tests", () => {
  describe("functional tests", () => {
    /**
     * Verify that the client init() function runs
     */
    it("runs client init()", (done) => {
      let error = `did not run init`;
      class ClientClass {
        init() {
          error = undefined;
        }
      }
      class ServerClass {
        onConnect() {
          this.quit();
        }
        teardown() {
          done(error);
        }
      }
      const { webServer } = createServer(ServerClass);
      webServer.listen(0, () => {
        createClient(
          ClientClass,
          `http://localhost:${webServer.address().port}`,
        );
      });
    });

    /**
     * Verify that the client init() function runs when wrapped as web client
     */
    it("runs client init() when used as webclient", (done) => {
      let error = `did not run init`;
      class ClientClass {
        init() {
          error = undefined;
        }
      }
      class ServerClass {
        onConnect() {
          this.quit();
        }
        teardown() {
          done(error);
        }
      }
      const factory = linkClasses(ClientClass, ServerClass);
      const { webServer } = factory.createServer();
      webServer.listen(0, () => {
        factory.createWebClient(
          `http://localhost:${webServer.address().port}`,
          `.`,
        );
      });
    });
  });

  describe("connectivity tests", () => {
    /**
     * Basic client/server constellation
     */
    it("can run a server + client setup", (done) => {
      class ClientClass {
        onConnect = () => this.disconnect();
      }

      class ServerClass {
        onDisconnect = () => (this.clients.length ? null : this.quit());
        teardown = () => done();
      }

      const factory = linkClasses(ClientClass, ServerClass);
      const { webServer } = factory.createServer();
      webServer.listen(0, () => {
        factory.createClient(`http://localhost:${webServer.address().port}`);
      });
    });

    /**
     * Server with webclient constellation
     */
    it("can run a server + webclient setup", (done) => {
      class WebClientClass {
        onConnect = () => this.quit();
      }

      class ServerClass {
        onDisconnect = () => (this.clients.length ? null : this.quit());
        teardown = () => {
          done();
        };
      }

      const factory = linkClasses(WebClientClass, ServerClass);
      const { webServer } = factory.createServer();
      webServer.listen(0, () => {
        factory.createWebClient(
          `http://localhost:${webServer.address().port}`,
          `${__dirname}/webclient/basic`,
        );
      });
    });

    /**
     * Server with webclient constellation, with a browser connected
     */
    it("can run a server + webclient + browser setup", (done) => {
      class WebClientClass {}

      class ServerClass {
        onDisconnect() {
          this.clients.length ? null : this.quit();
        }
        teardown() {
          done();
        }
      }

      const factory = linkClasses(WebClientClass, ServerClass);
      const { webServer } = factory.createServer();
      webServer.listen(0, () => {
        const { client, clientWebServer } = factory.createWebClient(
          `http://localhost:${webServer.address().port}`,
          `${__dirname}/webclient/basic`,
        );

        clientWebServer.addRoute(`/quit`, (req, res) => {
          res.end("client disconnected");
          // Not sure why we need a timeout here, but if
          // we don't the browser get uppity on MacOS...
          setTimeout(() => client.quit(), 25);
        });

        clientWebServer.listen(0, async () => {
          const clientURL = `http://localhost:${
            clientWebServer.address().port
          }`;
          const browser = await puppeteer.launch({ headless: `new` });
          const page = await browser.newPage();

          await page.goto(clientURL);
          await page.waitForSelector(`#quit`);
          await page.click(`#quit`);
          await browser.close();
        });
      });
    });
  });

  describe("communication tests", () => {
    it("can ping-pong function calls", (done) => {
      let error;

      class ClientClass {
        async onConnect() {
          for (let i = 0; i < 10; i++) {
            const result = await this.server.ping(i);
            if (result !== i + 1) {
              error = new Error(
                `result ${result} does not match i+1 (${i + 1})`,
              );
            }
          }
          this.disconnect();
        }
      }

      class ServerClass {
        ping = async (client, pong) => pong + 1;

        async onDisconnect(client) {
          if (!this.clients.length) {
            this.quit();
          }
        }

        async teardown() {
          done(error);
        }
      }

      const factory = linkClasses(ClientClass, ServerClass);
      const { webServer } = factory.createServer();
      webServer.listen(0, () =>
        factory.createClient(`http://localhost:${webServer.address().port}`),
      );
    });

    it("can ping(pong)-ping(pong) function calls", (done) => {
      let error;
      let pings = 0;
      let pongs = 0;
      let final = 0;

      class ClientClass {
        async onConnect() {
          this.server.ping(1);
        }

        async ping(pong) {
          final = pong;
          pongs++;
          if (pong > 10) {
            return this.disconnect();
          }
          this.server.ping(pong + 1);
        }
      }

      class ServerClass {
        async ping(client, pong) {
          pings++;
          client.ping(pong + 1);
        }

        async onDisconnect() {
          if (!this.clients.length) {
            this.quit();
          }
        }

        async teardown() {
          if (pings !== 6 || pongs !== 6 || final !== 12) {
            error = new Error(`number of pings and pongs don't match the test`);
          }
          done(error);
        }
      }

      const factory = linkClasses(ClientClass, ServerClass);
      const { webServer } = factory.createServer();
      webServer.listen(0, () => {
        factory.createClient(`http://localhost:${webServer.address().port}`);
      });
    });

    it("verify that calling missing functions throws", (done) => {
      let error = `managed to "call" nonexistent function`;

      class ClientClass {}

      class ServerClass {
        async onConnect(client) {
          try {
            await client.nonexistent();
          } catch (e) {
            if (e.message.includes(`function is undefined.`)) {
              error = undefined;
            }
          }
          this.quit();
        }
        teardown = () => done(error);
      }

      const factory = linkClasses(ClientClass, ServerClass);
      const { webServer } = factory.createServer();
      webServer.listen(0, () => {
        factory.createClient(`http://localhost:${webServer.address().port}`);
      });
    });

    it("verify that calling a function that throws, correctly throws", (done) => {
      let error = `managed to "call" nonexistent function`;

      class ClientClass {
        async throwing() {
          return this.x();
        }
      }

      class ServerClass {
        async onConnect(client) {
          try {
            await client.throwing();
          } catch (e) {
            if (e.message.includes(`function threw instead of returning`)) {
              error = undefined;
            }
          }
          this.quit();
        }
        teardown = () => done(error);
      }

      const factory = linkClasses(ClientClass, ServerClass);
      const { webServer } = factory.createServer();
      webServer.listen(0, () => {
        factory.createClient(`http://localhost:${webServer.address().port}`);
      });
    });

    it("verify that private functions aren't exposed", (done) => {
      let error = `managed to call a private function`;

      class ClientClass {
        async #privateFunction() {
          return `this shouldn't work`;
        }
      }

      class ServerClass {
        async onConnect(client) {
          try {
            await client.privateFunction();
          } catch (e) {
            if (e.message.includes(`function is undefined.`)) {
              error = undefined;
            }
          }
          this.quit();
        }
        teardown = () => done(error);
      }

      const factory = linkClasses(ClientClass, ServerClass);
      const { webServer } = factory.createServer();
      webServer.listen(0, () => {
        factory.createClient(`http://localhost:${webServer.address().port}`);
      });
    });
  });

  describe(``, () => {
    const runtimeMetrics = {
      forced: 0,
      diff: 0,
    };

    [true, false].forEach((forced) => {
      it(`verify that the silo sync function can be called (forced=${forced})`, (done) => {
        let error = `silo was not updated`;

        class ClientClass {
          onSiloUpdate(data, forced) {
            error = undefined;
          }
          endTest() {
            const bytes = getBytesSent();
            runtimeMetrics[forced ? `forced` : `diff`] = bytes;
            this.disconnect();
          }
        }

        class ServerClass {
          async onConnect(client) {
            const players = [
              { id: `da2c55c8-7e48-4cf7-8ac1-e09635bba536` },
              { id: `992dc1f0-db6a-4f7d-88e0-f9e1945f2afa` },
              { id: `51ad8d81-2033-4306-86b1-07640c4639ac` },
              { id: `fb2e390a-484d-454e-a46a-13ac103167f4` },
            ];
            const game = {
              players: [],
              currentHand: undefined,
            };
            const data = { players, game };
            await client.syncData(data);

            game.players[0] = players[0];
            await client.syncData(data);

            game.players[1] = players[1];
            await client.syncData(data);

            game.players[2] = players[2];
            await client.syncData(data);

            game.players[3] = players[3];
            await client.syncData(data);

            players[0].name = "test1";
            players[1].name = "test2";
            players[2].name = "test3";
            players[3].name = "test4";
            await client.syncData(data);

            players[0].tiles = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
            players[1].tiles = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
            players[2].tiles = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
            players[3].tiles = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
            game.currentHand = {
              players,
              wind: 0,
            };
            await client.syncData(data);

            for (let i = 0; i < 4; i++) {
              game.currentHand.players[i].tiles = [
                1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
              ];
              game.currentHand.players[i].latest = 14;
              await client.syncData(data);

              game.currentHand.players[i].tiles = [
                1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
              ];
              game.currentHand.players[i].latest = undefined;
              await client.syncData(data);
            }

            client.endTest();
          }
          async onDisconnect() {
            if (this.clients.length === 0) {
              this.quit();
            }
          }
          teardown() {
            done(error);
          }
        }

        toggleForcedSync(forced);
        resetBytesSent();

        const factory = linkClasses(ClientClass, ServerClass);
        const { webServer } = factory.createServer();
        webServer.listen(0, () => {
          factory.createClient(`http://localhost:${webServer.address().port}`);
        });
      });
    });

    it("confirm diffs are smaller than full updates", () => {
      const { forced, diff } = runtimeMetrics;
      assert(forced > diff, `force updates use more bytes than diffs`);
    });
  });
});
