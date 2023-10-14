import puppeteer from "puppeteer";
import fs from "fs";
import url from "url";
const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
import { generateClientServer } from "../../src/index.js";

const ALLOW_SELF_SIGNED_CERTS = true;

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

const DEBUG = false;

describe("web client tests", () => {
  it("should run on a basic http setup", (done) => {
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
      browser = await puppeteer.launch({ headless: `new` });
      const page = await browser.newPage();
      await page.goto(`http://localhost:${clientWebServer.address().port}`);
      await page.waitForSelector(`.testfield`);
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

  it("should run on a https for the server, but basic http for the web client", (done) => {
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
      browser = await puppeteer.launch({ headless: `new` });
      const page = await browser.newPage();
      await page.goto(`http://localhost:${clientWebServer.address().port}`);
      await page.waitForSelector(`.testfield`);
      await page.click(`#quit`);
      await browser.close();
    };

    // Create the main server
    const factory = generateClientServer(ClientClass, ServerClass);
    server = factory.createServer(httpsOptions);
    server.listen(0, () => {
      const PORT = server.address().port;
      const url = `https://localhost:${PORT}`;
      if (DEBUG) console.log(`test server running on ${url}`);

      // Create a webclient, which creates a real client as well as
      // a web server so your browser can connect to something.
      clientWebServer = factory.createWebClient(
        url,
        `${__dirname}/public`,
        false,
        ALLOW_SELF_SIGNED_CERTS,
      );

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
        //if (DEBUG) console.log(`web client running on ${url}`);
      });

      runTests();
    });
  });

  it("should run on https for both the server and the webclient", (done) => {
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
        done()
      }
      test(client, a, b, c) {
        return [c, b, a].join(``);
      }
    }

    /**
     * Puppeteer in place of a real user.
     */
    let runTests = async () => {
      browser = await puppeteer.launch({
        headless: `new`,
        ignoreHTTPSErrors: true,
      });
      const page = await browser.newPage();
      await page.goto(`https://localhost:${clientWebServer.address().port}`);
      await page.waitForSelector(`.testfield`);
      await page.click(`#quit`);
      await browser.close();
    };

    // Create the main server
    const factory = generateClientServer(ClientClass, ServerClass);
    server = factory.createServer(httpsOptions);
    server.listen(0, () => {
      const PORT = server.address().port;
      const url = `https://localhost:${PORT}`;
      if (DEBUG) console.log(`test server running on ${url}`);

      // Create a webclient, which creates a real client as well as
      // a web server so your browser can connect to something.
      clientWebServer = factory.createWebClient(
        url,
        `${__dirname}/public`,
        httpsOptions,
        ALLOW_SELF_SIGNED_CERTS,
      );

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
        const url = `https://localhost:${PORT}`;
        if (DEBUG) console.log(`web client running on ${url}`);
      });

      runTests();
    });
  });
});
