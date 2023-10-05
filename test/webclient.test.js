import url from "url";
import path from "path";
import puppeteer from "puppeteer";
import { generateClientServer } from "../src/index.js";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

describe("web client tests", () => {
  it("should support all publicly documented properties and functions", (done) => {
    const functionCalls = [];
    let webclient, browser;

    /**
     * Puppeteer in place of a real user.
     */
    let runTests = async () => {
      browser = await puppeteer.launch({
        headless: `new`,
        // devtools: true
      });

      const page = await browser.newPage();
      page.on("console", (message) => console.log(`[LOG] ${message.text()}`));
      await page.goto(`http://localhost:${webclient.address().port}`);
      await page.waitForSelector(`#value`);
      await page.waitForSelector(`#quit`);
      await page.click(`#quit`);
    };

    /**
     * remote client.
     */
    class WebClientClass {
      onConnect() {
        expect(this.is_web_client).toBe(true);
      }
      onBrowserConnect() {
        expect(this.browser_connected).toBe(true);
      }
      onBrowserDisconnect() {
        expect(this.browser_connected).toBe(false);
      }
      async "test:set"(value) {
        functionCalls.push("test:set");
        this.state.value = value;
      }
    }

    /**
     * remote server.
     */
    class ServerClass {
      onConnect() {
        runTests();
      }
      onDisconnect(client) {
        this.quit();
      }
      async onQuit() {
        await browser.close();
        expect(functionCalls).toStrictEqual([
          "test:events", // initial seq_num=0 event
          "test:set",
          "test:events", // update for "value"
        ]);
        done();
      }
      async "test:receive"(client) {
        client.test.set("test");
      }
      async "test:events"(client) {
        functionCalls.push("test:events");
      }
    }

    /**
     * Build and run the server and client instances.
     */
    const ClientServer = generateClientServer(WebClientClass, ServerClass);
    const server = ClientServer.createServer();
    server.listen(0, () => {
      // console.log(
      //   `creating web client against server at http://localhost:${
      //     server.address().port
      //   }`
      // );
      webclient = ClientServer.createWebClient(
        `http://localhost:${server.address().port}`,
        path.join(__dirname, `public-test`),
      );
      webclient.addRoute(`/route-test`, function (client, request, response) {
        // we're not testing the handling, just the route adding.
      });
      webclient.listen(50000, () => {
        // console.log(
        //   `web client running on http://localhost:${webclient.address().port}`
        // );
      });
    });
  });
});
