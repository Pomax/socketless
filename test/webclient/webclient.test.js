import { linkClasses, ALLOW_SELF_SIGNED_CERTS } from "../../library.js";

import puppeteer from "puppeteer";
import url from "url";
const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

// self-signed certificate code for HTTPS:
import pem from "pem";
const httpsOptions = await new Promise((resolve, reject) => {
  pem.createCertificate(
    { days: 1, selfSigned: true },
    function (e, { clientKey: key, certificate: cert }) {
      if (e) return reject(e);
      resolve({ key, cert });
    }
  );
});

/**
 * ...
 * @param {*} done
 * @param {*} getError
 * @returns
 */
function getClasses(done, getError) {
  class ClientClass {
    async onConnect() {
      this.interval = setInterval(
        () =>
          this.setState({
            randomValue: Math.random(),
          }),
        3000
      );
    }
    onQuit() {
      clearInterval(this.interval);
      delete this.interval;
    }
  }

  class ServerClass {
    async onDisconnect(client) {
      if (this.clients.length === 0) {
        this.quit();
      }
    }
    async teardown() {
      done(getError());
    }
    async test(client, a, b, c) {
      return [c, b, a].join(``);
    }
  }
  return { ClientClass, ServerClass };
}

describe("web client tests", () => {
  /**
   * ...docs go here...
   */
  it("should run on a basic http setup", (done) => {
    let error;
    const { ClientClass, ServerClass } = getClasses(done, () => error);
    const factory = linkClasses(ClientClass, ServerClass);
    const server = factory.createServer();
    server.listen(0, () => {
      const PORT = server.address().port;
      const url = `http://localhost:${PORT}`;
      const { client, clientWebServer } = factory.createWebClient(
        url,
        `${__dirname}/dedicated`
      );

      clientWebServer.addRoute(`/quit`, (req, res) => {
        res.end("client disconnected");
        // Not sure why we need a timeout here, but if
        // we don't the browser get uppity on MacOS...
        setTimeout(() => client.quit(), 25);
      });

      clientWebServer.listen(0, async () => {
        const browser = await puppeteer.launch({ headless: `new` });
        const page = await browser.newPage();
        page.on(
          "pageerror",
          (msg) => (error = new Error(`[browser error]`, msg))
        );
        page.on("console", (msg) => console.log(`[browser log]`, msg.text()));
        await page.goto(`http://localhost:${clientWebServer.address().port}`);
        await page.waitForSelector(`.testfield`);
        await page.click(`#quit`);
        await browser.close();
      });
    });
  });

  /**
   * ...
   */
  it("should run on a https for the server, but basic http for the web client", (done) => {
    let error;
    const { ClientClass, ServerClass } = getClasses(done, () => error);
    const factory = linkClasses(ClientClass, ServerClass);
    const server = factory.createServer(httpsOptions);
    server.listen(0, () => {
      const PORT = server.address().port;
      const url = `https://localhost:${PORT}`;
      const { client, clientWebServer } = factory.createWebClient(
        url,
        `${__dirname}/dedicated`,
        false,
        ALLOW_SELF_SIGNED_CERTS
      );

      clientWebServer.addRoute(`/quit`, (req, res) => {
        res.end("client disconnected");
        // Not sure why we need a timeout here, but if
        // we don't the browser get uppity on MacOS...
        setTimeout(() => client.quit(), 25);
      });

      clientWebServer.listen(0, async () => {
        const url = `http://localhost:${clientWebServer.address().port}`;
        const browser = await puppeteer.launch({ headless: `new` });
        const page = await browser.newPage();
        page.on(
          "pageerror",
          (msg) => (error = new Error(`[browser error]`, msg))
        );
        page.on("console", (msg) => console.log(`[browser log]`, msg.text()));
        await page.goto(url);
        await page.waitForSelector(`.testfield`);
        await page.click(`#quit`);
        await browser.close();
      });
    });
  });

  /**
   * ...
   */
  it("should run on https for both the server and the webclient", (done) => {
    let error;
    const { ClientClass, ServerClass } = getClasses(done, () => error);
    const factory = linkClasses(ClientClass, ServerClass);
    const server = factory.createServer(httpsOptions);
    server.listen(0, () => {
      const PORT = server.address().port;
      const url = `https://localhost:${PORT}`;
      const { client, clientWebServer } = factory.createWebClient(
        url,
        `${__dirname}/dedicated`,
        httpsOptions,
        ALLOW_SELF_SIGNED_CERTS
      );

      clientWebServer.addRoute(`/quit`, (req, res) => {
        res.end("client disconnected");
        // Not sure why we need a timeout here, but if
        // we don't the browser get uppity on MacOS...
        setTimeout(() => client.quit(), 25);
      });

      clientWebServer.listen(0, async () => {
        const browser = await puppeteer.launch({
          headless: `new`,
          ignoreHTTPSErrors: true,
        });
        const page = await browser.newPage();
        page.on(
          "pageerror",
          (msg) => (error = new Error(`[browser error]`, msg))
        );
        page.on("console", (msg) => console.log(`[browser log]`, msg.text()));
        await page.goto(`https://localhost:${clientWebServer.address().port}`);
        await page.waitForSelector(`.testfield`);
        await page.click(`#quit`);
        await browser.close();
      });
    });
  });
});
