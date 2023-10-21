import puppeteer from "puppeteer";
import { linkClasses } from "../src/index.js";
import url from "url";
const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

describe("basic tests", () => {
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
      const { webserver } = factory.createServer();
      webserver.listen(0, () => {
        factory.createClient(`http://localhost:${webserver.address().port}`);
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
      const { webserver } = factory.createServer();
      webserver.listen(0, () => {
        factory.createWebClient(
          `http://localhost:${webserver.address().port}`,
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
      const { webserver } = factory.createServer();
      webserver.listen(0, () => {
        const { client, clientWebServer } = factory.createWebClient(
          `http://localhost:${webserver.address().port}`,
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
      const { webserver } = factory.createServer();
      webserver.listen(0, () =>
        factory.createClient(`http://localhost:${webserver.address().port}`),
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
      const { webserver } = factory.createServer();
      webserver.listen(0, () => {
        factory.createClient(`http://localhost:${webserver.address().port}`);
      });
    });
  });
});
