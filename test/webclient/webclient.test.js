import { WebSocket } from "ws";
import { linkClasses, ALLOW_SELF_SIGNED_CERTS } from "../../src/index.js";

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
    },
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
        3000,
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
    const { webserver } = factory.createServer();
    webserver.listen(0, () => {
      const PORT = webserver.address().port;
      const serverURL = `http://localhost:${PORT}`;
      const { client, clientWebServer } = factory.createWebClient(
        serverURL,
        `${__dirname}/dedicated`,
      );

      clientWebServer.addRoute(`/quit`, (req, res) => {
        res.end("client disconnected");
        // Not sure why we need a timeout here, but if
        // we don't the browser get uppity on MacOS...
        setTimeout(() => client.quit(), 25);
      });

      clientWebServer.listen(0, async () => {
        const clientURL = `http://localhost:${clientWebServer.address().port}`;
        const browser = await puppeteer.launch({ headless: `new` });
        const page = await browser.newPage();
        page.on(
          "pageerror",
          (msg) => (error = new Error(`[browser error]`, msg)),
        );
        page.on("console", (msg) => console.log(`[browser log]`, msg.text()));
        await page.goto(clientURL);
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
    const { webserver } = factory.createServer(httpsOptions);
    webserver.listen(0, () => {
      const PORT = webserver.address().port;
      const serverURL = `https://localhost:${PORT}`;
      const { client, clientWebServer } = factory.createWebClient(
        serverURL,
        `${__dirname}/dedicated`,
        false,
        ALLOW_SELF_SIGNED_CERTS,
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
          (msg) => (error = new Error(`[browser error]`, msg)),
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
    const { webserver } = factory.createServer(httpsOptions);
    webserver.listen(0, () => {
      const PORT = webserver.address().port;
      const url = `https://localhost:${PORT}`;
      const { client, clientWebServer } = factory.createWebClient(
        url,
        `${__dirname}/dedicated`,
        httpsOptions,
        ALLOW_SELF_SIGNED_CERTS,
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
          (msg) => (error = new Error(`[browser error]`, msg)),
        );
        page.on("console", (msg) => console.log(`[browser log]`, msg.text()));
        await page.goto(`https://localhost:${clientWebServer.address().port}`);
        await page.waitForSelector(`.testfield`);
        await page.click(`#quit`);
        await browser.close();
      });
    });
  });

  /**
   * ...docs go here...
   */
  it("should reject socketless connections on SID mismatch", (done) => {
    let error = `connection was allowed through`;
    const { ClientClass, ServerClass } = getClasses(done, () => error);
    const factory = linkClasses(ClientClass, ServerClass);
    const { webserver } = factory.createServer();
    webserver.listen(0, () => {
      const sid = "testing";
      const PORT = webserver.address().port;
      const serverURL = `http://localhost:${PORT}`;
      const { client, clientWebServer } = factory.createWebClient(
        `${serverURL}?sid=${sid}`,
        `${__dirname}/dedicated`,
      );

      clientWebServer.listen(0, async () => {
        const clientURL = `http://localhost:${clientWebServer.address().port}`;
        const browser = await puppeteer.launch({ headless: `new` });
        const page = await browser.newPage();
        page.on("console", (msg) => {
          msg = msg.text();
          if (
            msg ===
            `Failed to load resource: the server responded with a status of 404 (Not Found)`
          ) {
            error = undefined;
          }
        });
        await page.goto(clientURL);
        await new Promise((resolve) => setTimeout(resolve, 100));
        await browser.close();
        client.quit();
      });
    });
  });

  /**
   * ...docs go here...
   */
  it("should honour socketless connections on SID match", (done) => {
    let error;
    const { ClientClass, ServerClass } = getClasses(done, () => error);
    const factory = linkClasses(ClientClass, ServerClass);
    const { webserver } = factory.createServer();
    webserver.listen(0, () => {
      const sid = "testing";
      const PORT = webserver.address().port;
      const serverURL = `http://localhost:${PORT}`;
      const { client, clientWebServer } = factory.createWebClient(
        `${serverURL}?sid=${sid}`,
        `${__dirname}/dedicated`,
      );

      clientWebServer.addRoute(`/quit`, (req, res) => {
        res.end("client disconnected");
        // Not sure why we need a timeout here, but if
        // we don't the browser get uppity on MacOS...
        setTimeout(() => client.quit(), 25);
      });

      clientWebServer.listen(0, async () => {
        const clientURL = `http://localhost:${clientWebServer.address().port}`;
        const browser = await puppeteer.launch({ headless: `new` });
        const page = await browser.newPage();
        await page.goto(`${clientURL}?sid=${sid}`);
        await page.waitForSelector(`.testfield`);
        await page.click(`#quit`);
        await browser.close();
      });
    });
  });

  /**
   * ...docs go here...
   */
  it("should reject bare websocket connection on SID mismatch", (done) => {
    let error = `connection was allowed through`;
    const { ClientClass, ServerClass } = getClasses(done, () => error);
    const factory = linkClasses(ClientClass, ServerClass);
    const { webserver } = factory.createServer();
    webserver.listen(0, () => {
      const sid = "testing";
      const PORT = webserver.address().port;
      const serverURL = `http://localhost:${PORT}`;
      const { client, clientWebServer } = factory.createWebClient(
        `${serverURL}?sid=${sid}`,
        `${__dirname}/dedicated`,
      );

      clientWebServer.listen(0, async () => {
        const clientURL = `http://localhost:${clientWebServer.address().port}`;
        const ws = new WebSocket(clientURL);
        ws.on(`error`, (err) => {
          if (err.message === `socket hang up`) {
            error = undefined;
            client.quit();
          }
        });
      });
    });
  });

  /**
   * ...docs go here...
   */
  it("should allow bare websocket connection if SID matches", (done) => {
    let error;
    const { ClientClass, ServerClass } = getClasses(done, () => error);
    const factory = linkClasses(ClientClass, ServerClass);
    const { webserver } = factory.createServer();
    webserver.listen(0, () => {
      const sid = "testing";
      const PORT = webserver.address().port;
      const serverURL = `http://localhost:${PORT}`;
      const { client, clientWebServer } = factory.createWebClient(
        `${serverURL}?sid=${sid}`,
        `${__dirname}/dedicated`,
      );

      clientWebServer.listen(0, async () => {
        const clientURL = `http://localhost:${clientWebServer.address().port}`;
        const ws = new WebSocket(`${clientURL}?sid=${sid}`);
        const readyState = await new Promise((resolve) =>
          setTimeout(() => resolve(ws.readyState), 500),
        );
        if (readyState !== 1) {
          error = `websocket connection should have been allowed through`;
        }
        ws.close();
        client.quit();
      });
    });
  });
});
