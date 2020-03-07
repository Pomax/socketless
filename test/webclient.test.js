const path = require(`path`);
const puppeteer = require("puppeteer");

const { generateClientServer } = require(`../src/generate-client-server.js`);

describe("web client tests", () => {
  it("should support all publically documented properties and functions", async done => {
    let webclient;
    let runTests = async () => {
      const browser = await puppeteer.launch({
        // devtools: true
      });
      const page = await browser.newPage();
      await page.goto(`http://localhost:${webclient.address().port}`);
      await page.waitForSelector(`#value`);
      await page.waitForSelector(`#quit`);
      await page.click(`#quit`);
    };

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
        this.state.value = value;
      }
    }

    class ServerClass {
      onConnect() {
        runTests();
      }
      onDisconnect(client) {
        this.quit();
      }
      async onQuit() {
        await browser.close();
        done();
      }
      async "test:receive"(client) {
        client.test.set("test");
      }
    }

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
