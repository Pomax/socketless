import puppeteer from "puppeteer";
import url from "url";
const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

import { generateClientServer } from "../../src/index.js";

const DEBUG = false;

describe("web client tests", () => {
  it("should run", (done) => {
    let server, clientWebServer, browser;

    /**
     * ...
     */
    class ClientClass {
      async onConnect() {
        this.int = setInterval(
          () =>
            this.setState({
              randomValue: Math.random(),
            }),
          3000,
        );
      }
      onQuit() {
        clearInterval(this.int);
        delete this.int;
      }
    }

    /**
     * ...
     */
    class ServerClass {
      async onConnect(client) {
        if (DEBUG) console.log(`client registered at server`);
      }
      async onDisconnect(client) {
        if (DEBUG) console.log(`server: client ${client.id} disconnected`);
        if (this.clients.length === 0) {
          if (DEBUG) console.log(`no clients left, quitting`);
          this.quit();
        }
      }
      async teardown() {
        // Fun bit of Jest nonsense, it'll complain that the server is still running,
        // which it isn't, Jest just tries to exit before the socket's fully closed.
        setTimeout(() => done(), 1000);
      }
      test(client, a, b, c) {
        return [c, b, a].join(``);
      }
    }

    /**
     * Puppeteer in place of a real user.
     */
    let runTests = async () => {
      if (DEBUG) console.log(`running tests: creating browser`);
      browser = await puppeteer.launch({ headless: `new` });
      if (DEBUG) console.log(`setting up console interception`);
      const page = await browser.newPage();
      page.on("console", (message) =>
        DEBUG ? console.log(`[BROWSER] ${message.text()}`) : null,
      );
      if (DEBUG) console.log(`navigating to page...`);
      await page.goto(`http://localhost:${clientWebServer.address().port}`);
      if (DEBUG) console.log(`waiting for elements...`);
      await page.waitForSelector(`.testfield`);
      if (DEBUG) console.log(`puppeteer done.`);
      await page.click(`#quit`);
      await browser.close();
    };

    // Create the main server
    const factory = generateClientServer(ClientClass, ServerClass);
    server = factory.createServer();
    server.listen(0, () => {
      const PORT = server.address().port;
      const url = `http://localhost:${PORT}`;
      if (DEBUG) console.log(`test server running on ${url}`);

      // Create a webclient, which creates a real client as well as
      // a web server so your browser can connect to something.
      clientWebServer = factory.createWebClient(url, `${__dirname}/public`);

      clientWebServer.addRoute(`/quit`, function (client, request, response) {
        if (DEBUG)
          console.log(
            `web client called /quit on client, calling client.disconnect() to disconnect from server.`,
          );
        client.quit();
        response.write("client disconnected");
        response.end();
        if (DEBUG) console.log(`shutting down client web server`);
        clientWebServer.close();
      });

      clientWebServer.listen(0, () => {
        const PORT = clientWebServer.address().port;
        const url = `http://localhost:${PORT}`;
        if (DEBUG) console.log(`web client running on ${url}`);
      });

      runTests();
    });
  });
});
