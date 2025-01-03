import { WebSocket } from "ws";
import {
  linkClasses,
  createWebClient,
  ALLOW_SELF_SIGNED_CERTS,
} from "../../src/index.js";

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

async function getPage(browser, onError) {
  const page = await browser.newPage();
  page.on("console", (msg) => console.log(`[browser log: ${msg.text()}]`));
  page.on("pageerror", (msg) => {
    console.log(`[browser error]`, msg);
    onError?.(new Error(msg));
  });
  return page;
}

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
      done(getError?.());
    }
    async test(client, a, b, c) {
      return [c, b, a].join(``);
    }
  }
  return { ClientClass, ServerClass };
}

describe("web client tests", () => {
  it("should run on a basic http setup", (done) => {
    let error;
    const { ClientClass, ServerClass } = getClasses(done, () => error);
    const factory = linkClasses(ClientClass, ServerClass);
    const { webServer } = factory.createServer();
    webServer.listen(0, () => {
      const PORT = webServer.address().port;
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
        const page = await getPage(browser, (msg) => (error = msg));
        await page.goto(clientURL);
        await page.waitForSelector(`.testfield`);
        await page.click(`#quit`);
        await browser.close();
      });
    });
  });

  it("should run on a https for the server, but basic http for the web client", (done) => {
    let error;
    const { ClientClass, ServerClass } = getClasses(done, () => error);
    const factory = linkClasses(ClientClass, ServerClass);
    const { webServer } = factory.createServer(httpsOptions);
    webServer.listen(0, () => {
      const PORT = webServer.address().port;
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
        const page = await getPage(browser, (msg) => (error = msg));
        await page.goto(url);
        await page.waitForSelector(`.testfield`);
        await page.click(`#quit`);
        await browser.close();
      });
    });
  });

  it("should run on https for both the server and the webclient", (done) => {
    let error;
    const { ClientClass, ServerClass } = getClasses(done, () => error);
    const factory = linkClasses(ClientClass, ServerClass);
    const { webServer } = factory.createServer(httpsOptions);
    webServer.listen(0, () => {
      const PORT = webServer.address().port;
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
        const page = await getPage(browser, (msg) => (error = msg));
        await page.goto(`https://localhost:${clientWebServer.address().port}`);
        await page.waitForSelector(`.testfield`);
        await page.click(`#quit`);
        await browser.close();
      });
    });
  });

  it("should reject socketless connections on SID mismatch", (done) => {
    let error = `connection was allowed through`;
    const { ClientClass, ServerClass } = getClasses(done, () => error);
    const factory = linkClasses(ClientClass, ServerClass);
    const { webServer } = factory.createServer();
    webServer.listen(0, () => {
      const sid = "testing";
      const PORT = webServer.address().port;
      const serverURL = `http://localhost:${PORT}`;
      const { client, clientWebServer } = factory.createWebClient(
        `${serverURL}?sid=${sid}`,
        `${__dirname}/dedicated`,
      );

      clientWebServer.listen(0, async () => {
        const clientURL = `http://localhost:${clientWebServer.address().port}`;
        const browser = await puppeteer.launch({ headless: `new` });
        const page = await getPage(browser);
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

  it("should honour socketless connections on SID match", (done) => {
    let error;
    const { ClientClass, ServerClass } = getClasses(done, () => error);
    const factory = linkClasses(ClientClass, ServerClass);
    const { webServer } = factory.createServer();
    webServer.listen(0, () => {
      const sid = "testing";
      const PORT = webServer.address().port;
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
        const page = await getPage(browser, (msg) => (error = msg));
        await page.goto(`${clientURL}?sid=${sid}`);
        await page.waitForSelector(`.testfield`);
        await page.click(`#quit`);
        await browser.close();
      });
    });
  });

  it("should reject bare websocket connection on SID mismatch", (done) => {
    let error = `connection was allowed through`;
    const { ClientClass, ServerClass } = getClasses(done, () => error);
    const factory = linkClasses(ClientClass, ServerClass);
    const { webServer } = factory.createServer();

    webServer.listen(0, () => {
      const sid = "testing";
      const PORT = webServer.address().port;
      const serverURL = `http://localhost:${PORT}`;
      const { client, clientWebServer } = factory.createWebClient(
        `${serverURL}?sid=${sid}`,
        `${__dirname}/dedicated`,
      );

      clientWebServer.listen(0, async () => {
        const clientURL = `http://localhost:${clientWebServer.address().port}`;

        setTimeout(() => {
          const ws = new WebSocket(clientURL);
          ws.on(`error`, (err) => {
            error = undefined;
            client.quit();
          });
        }, 100);
      });
    });
  });

  it("should allow bare websocket connection if SID matches", (done) => {
    let error;
    const { ClientClass, ServerClass } = getClasses(done, () => error);
    const factory = linkClasses(ClientClass, ServerClass);
    const { webServer } = factory.createServer();
    webServer.listen(0, () => {
      const sid = "testing";
      const PORT = webServer.address().port;
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

  it("should sync state between client and browser", (done) => {
    let error = `state did not sync correctly`;

    // Note that this test is a bit doubling up, as we already
    // test the changeFlags functionality in core.test.js, so we
    // know what the changeFlags object should look like given
    // the changes in state. However, we do want to make sure
    // that the transport mechanism ends up sending the correct
    // data, so the doubling up makes sense.

    const list = [1, 2, 3, 4, 5];

    class ServerClass {
      onDisconnect() {
        if (this.clients.length === 0) {
          this.quit();
        }
      }
      teardown() {
        done(error);
      }
    }

    let arr = [];

    class ClientClass {
      onBrowserConnect() {
        const run = () => {
          const v = list.shift();
          arr.push(v);
          this.setState({
            a: {
              b: {
                // remove "c" at some point
                c: arr.length < 3 ? "test" : undefined,
                // update "d" every iteration
                d: Math.random(),
              },
              // test for a growing array
              e: arr,
            },
            v,
          });
          if (v) setTimeout(run, 50);
        };
        run();
      }
    }

    const factory = linkClasses(ClientClass, ServerClass);
    const { webServer } = factory.createServer();

    webServer.listen(0, () => {
      const PORT = webServer.address().port;
      const serverURL = `http://localhost:${PORT}`;
      const { client, clientWebServer } = factory.createWebClient(
        serverURL,
        `${__dirname}/stateful`,
      );

      clientWebServer.listen(0, async () => {
        const clientURL = `http://localhost:${clientWebServer.address().port}`;
        const browser = await puppeteer.launch({ headless: `new` });

        const page = await getPage(browser, async (msg) => {
          await browser.close();
          error = msg;
          client.quit();
        });

        await page.goto(clientURL);
        await page.waitForSelector(`body.done`);
        await browser.close();
        error = ``;
        client.quit();
      });
    });
  });

  it("should allow browser connection without server", (done) => {
    let browser;

    const { clientWebServer } = createWebClient(
      class {
        async teardown() {
          await browser.close();
          done();
        }
      },
      `http://localhost:8000`,
      `${__dirname}/standalone`,
    );

    clientWebServer.listen(0, async () => {
      const clientURL = `http://localhost:${clientWebServer.address().port}`;
      browser = await puppeteer.launch({ headless: `new` });
      const page = await getPage(browser);
      await page.goto(clientURL);
    });
  });

  it("should lock the browser state to prevent modification", (done) => {
    let browser;
    let error = undefined;

    const { client, clientWebServer } = createWebClient(
      class {
        async teardown() {
          await browser.close();
          done(error);
        }
        async updateValue() {
          this.setState({ a: { b: { c: 1 } } });
        }
      },
      `http://localhost:8000`,
      `${__dirname}/statemod`,
    );

    clientWebServer.listen(0, async () => {
      const clientURL = `http://localhost:${clientWebServer.address().port}`;
      browser = await puppeteer.launch({ headless: `new` });
      const page = await getPage(browser, (msg) => {
        error = msg;
      });
      await page.goto(clientURL);
    });
  });

  it("should parse query args in the browser", () => {
    return new Promise(async (resolve, reject) => {
      let browser;
      let error = `test did not run`;

      const { client, clientWebServer } = createWebClient(
        class {
          async pass() {
            error = undefined;
            this.quit();
          }
          async fail(reason) {
            error = reason;
            this.quit();
          }
          async teardown() {
            await browser.close();
            if (error) reject(new Error(error));
            else resolve();
          }
        },
        `http://localhost:8000`,
        `${__dirname}/params`,
      );

      const targetsFile = import.meta.url.replace(
        `webclient.test.js`,
        `params/targets.js`,
      );

      const { targets } = await import(targetsFile);

      const query = Object.entries(targets)
        .map(([key, value]) => {
          return `${key}=${JSON.stringify(value)}`;
        })
        .join(`&`);

      clientWebServer.listen(0, async () => {
        const clientURL = `http://localhost:${
          clientWebServer.address().port
        }?${query}`;
        browser = await puppeteer.launch({ headless: `new` });
        const page = await getPage(browser);
        await page.goto(clientURL);
      });
    });
  });

  it(`should pass client class through when flag is true`, () => {
    let browser;

    class ServerClass {
      onDisconnect() {
        if (this.clients.length === 0) {
          this.quit();
        }
      }
      teardown() {
        browser.close();
        done();
      }
      testCall(client) {
        client.runPassThroughTest(`testing`);
      }
    }

    class ClientClass {
      init() {
        this.togglePassThrough(true);
      }
      onBrowserConnect() {
        this.server.testCall();
      }
      runPassThroughTest(text) {
        // Do nothing, here. Instead have the browser handle this.
      }
      passthroughReceived() {
        this.quit();
      }
    }

    const factory = linkClasses(ClientClass, ServerClass);
    const { webServer } = factory.createServer();

    webServer.listen(0, () => {
      const PORT = webServer.address().port;
      const serverURL = `http://localhost:${PORT}`;
      const { client, clientWebServer } = factory.createWebClient(
        serverURL,
        `${__dirname}/pass-through`,
      );

      clientWebServer.listen(0, async () => {
        const clientURL = `http://localhost:${clientWebServer.address().port}`;
        browser = await puppeteer.launch({ headless: `new` });
        const page = await getPage(browser);
        await page.goto(clientURL);
      });
    });
  });

  it(`should not pass client class through when flag is false`, () => {
    let browser;
    let error = undefined;

    class ServerClass {
      init() {
        setTimeout(() => {
          this.clients.forEach((c) => c.disconnect());
          this.quit();
        }, 1000);
      }
      teardown() {
        done(error);
      }
      testCall(client) {
        client.runPassThroughTest(`testing`);
      }
    }

    class ClientClass {
      onBrowserConnect() {
        this.server.testCall();
      }
      onDisconnect() {
        browser.close();
        this.quit();
      }
      runPassThroughTest(text) {}
      passthroughReceived() {
        error = `function passed through despite flag being false`;
      }
    }

    const factory = linkClasses(ClientClass, ServerClass);
    const { webServer } = factory.createServer();

    webServer.listen(0, () => {
      const PORT = webServer.address().port;
      const serverURL = `http://localhost:${PORT}`;
      const { client, clientWebServer } = factory.createWebClient(
        serverURL,
        `${__dirname}/pass-through`,
      );

      clientWebServer.listen(0, async () => {
        const clientURL = `http://localhost:${clientWebServer.address().port}`;
        browser = await puppeteer.launch({ headless: `new` });
        const page = await getPage(browser);
        await page.goto(clientURL);
      });
    });
  });
});
