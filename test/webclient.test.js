const path = require(`path`);
const puppeteer = require("puppeteer");

const { generateClientServer } = require(`../src/generate-client-server.js`);

describe("web client tests", () => {
  it("should support all publically documented properties and functions", async done => {
    const functionCalls = [];
    let webclient;

    /**
     * Puppeteer in place of a real user.
     */
    let runTests = async () => {
      const browser = await puppeteer.launch({
        devtools: true
      });
      const page = await browser.newPage();
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
      webclient = ClientServer.createWebClient(
        `http://localhost:${server.address().port}`,
        path.join(__dirname, `public-test`)
      );
      webclient.listen(0);
    });
  });
});
