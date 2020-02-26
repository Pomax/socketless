const path = require(`path`);
const fetch = require(`node-fetch`);
const { generateClientServer } = require(`../src/generate-client-server.js`);

describe("web client tests", () => {
  let webclient;

  it("should support all publically documented properties and functions", async (done) => {
    class WebClientClass {
      async onConnect() {
        await page.goto(`http://localhost:${webclient.address().port}`);
        await page.click('#quit');
      }
      async "test:set"(value) {
        this.value = value;
      }
    }

    class ServerClass {
      onDisconnect(client) {
        this.quit();
      }
      async onQuit() {
        await browser.close();
        done();
      }
      async "test:receive"(client) {
        client.test.set('test');
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
