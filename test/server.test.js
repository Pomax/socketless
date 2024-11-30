import { linkClasses, ALLOW_SELF_SIGNED_CERTS } from "../src/index.js";
import express from "express";
import http from "http";
import https from "https";
import pem from "pem";
import { exec } from "child_process";

function execute(command) {
  return new Promise((resolve, reject) => {
    exec(command, (e, out, err) => (e ? reject(err) : resolve(out)));
  });
}

const httpsOptions = await new Promise((resolve, reject) => {
  pem.createCertificate(
    { days: 1, selfSigned: true },
    (err, { clientKey: key, certificate: cert }) =>
      err ? reject(err) : resolve({ key, cert }),
  );
});

describe("server tests", () => {
  it(`can create plain http server`, (done) => {
    class ServerClass {
      onDisconnect = () => (this.clients.length ? null : this.quit());
      teardown = () => done();
    }

    class ClientClass {
      onConnect = () => this.disconnect();
    }

    const factory = linkClasses(ClientClass, ServerClass);
    const { webServer } = factory.createServer();

    webServer.listen(0, () =>
      factory.createClient(`http://localhost:${webServer.address().port}`),
    );
  });

  it(`can run with user-provided plain http server`, (done) => {
    let error;

    class ServerClass {
      onDisconnect = () => (this.clients.length ? null : this.quit());
      teardown = () => done(error && new Error(error));
    }

    class ClientClass {
      onConnect = () => this.disconnect();
    }

    const factory = linkClasses(ClientClass, ServerClass);
    const server = http.createServer();
    const { webServer } = factory.createServer(server);

    if (server !== webServer) {
      error = "different servers?";
    }

    webServer.listen(0, () =>
      factory.createClient(`http://localhost:${webServer.address().port}`),
    );
  });

  it(`can create https server`, (done) => {
    class ServerClass {
      onDisconnect = () => (this.clients.length ? null : this.quit());
      teardown = () => done();
    }

    class ClientClass {
      onConnect = () => this.disconnect();
    }

    const factory = linkClasses(ClientClass, ServerClass);
    const { webServer } = factory.createServer(httpsOptions);
    webServer.listen(0, () => {
      factory.createClient(
        `https://localhost:${webServer.address().port}`,
        ALLOW_SELF_SIGNED_CERTS,
      );
    });
  });

  it(`rejects https server with self-signed certificate without ALLOW_SELF_SIGNED_CERTS`, (done) => {
    let error = `connection was allowed through`;

    class ServerClass {
      teardown = () => done(error && new Error(error));
    }

    class ClientClass {
      onError(err) {
        if (err.message === `self-signed certificate`) {
          error = undefined;
        }
        server.quit();
      }
    }

    const factory = linkClasses(ClientClass, ServerClass);
    const { server, webServer } = factory.createServer(httpsOptions);
    webServer.listen(0, () => {
      factory.createClient(`https://localhost:${webServer.address().port}`);
    });
  });

  it(`can run with user-provided https server`, (done) => {
    let error;

    class ServerClass {
      onDisconnect = () => (this.clients.length ? null : this.quit());
      teardown = () => done(error && new Error(error));
    }

    class ClientClass {
      onConnect = () => this.disconnect();
    }

    const factory = linkClasses(ClientClass, ServerClass);
    const server = https.createServer(httpsOptions);
    const { webServer } = factory.createServer(server);

    if (server !== webServer) {
      error = "different servers?";
    }

    webServer.listen(0, () => {
      factory.createClient(
        `https://localhost:${webServer.address().port}`,
        ALLOW_SELF_SIGNED_CERTS,
      );
    });
  });

  it(`can run with user-provided plain http Express server`, (done) => {
    let error;

    class ServerClass {
      onDisconnect = () => (this.clients.length ? null : this.quit());
      teardown = () => done(error && new Error(error));
    }

    class ClientClass {
      onConnect = () => this.disconnect();
    }

    // Set up an express app...
    const app = express();

    //...with a dummy route...
    const ROUTE_TEXT = `ROUTE OK`;
    app.get(`/`, (_, res) => res.send(ROUTE_TEXT));

    // ...and then start it up.
    const server = app.listen(0, async () => {
      // verify the server works
      const serverURL = `http://localhost:${server.address().port}/`;
      const response = await fetch(serverURL);
      const data = await response.text();

      if (data !== ROUTE_TEXT) {
        error = `incorrect page response`;
      }

      // then test socketless functionality
      const factory = linkClasses(ClientClass, ServerClass);
      factory.createServer(server);
      factory.createClient(serverURL);
    });
  });

  it(`can run with user-provided https Express server`, (done) => {
    let error;

    class ServerClass {
      onDisconnect = () => (this.clients.length ? null : this.quit());
      teardown = () => done(error && new Error(error));
    }

    class ClientClass {
      onConnect = () => this.disconnect();
    }

    // Set up an express app...
    const app = express();

    //...with a dummy route...
    const ROUTE_TEXT = `ROUTE OK`;
    app.get(`/`, (_, res) => res.send(ROUTE_TEXT));

    // ...and then start it with https functionality.
    const server = https.createServer(httpsOptions, app);
    server.listen(0, async () => {
      // verify the server works. Unfortunately, when we add express
      // the combination of https + fetch + Jest runs into problems
      // over the self-signed cert, so we outsource this one to curl:
      const serverURL = `https://localhost:${server.address().port}/`;
      const result = await execute(`curl --insecure ${serverURL}`);

      if (result !== ROUTE_TEXT) {
        error = `incorrect page response`;
      }

      // then test socketless functionality
      const factory = linkClasses(ClientClass, ServerClass);
      factory.createServer(server);
      factory.createClient(
        `https://localhost:${server.address().port}`,
        ALLOW_SELF_SIGNED_CERTS,
      );
    });
  });

  it(`disallows calls from uncleared clients`, (done) => {
    let error = `client was allowed to call locked function`;

    class ServerClass {
      init() {
        this.api = this.lock({
          test: (client, ...args) => {
            console.log(`this log should not be possible`);
          },
        });
      }
      onDisconnect = () => (this.clients.length ? null : this.quit());
      teardown = () => done(error && new Error(error));
    }

    class ClientClass {
      onConnect = async () => {
        try {
          await this.server.api.test(1, 2, 3);
        } catch (e) {
          if (
            e.message === `no access permission on server:api:test for client`
          ) {
            error = undefined;
          }
        }
        this.disconnect();
      };
    }

    const factory = linkClasses(ClientClass, ServerClass);
    const { webServer } = factory.createServer();
    webServer.listen(0, () =>
      factory.createClient(`http://localhost:${webServer.address().port}`),
    );
  });

  it(`allows calls from cleared clients`, (done) => {
    let error = `client is not allowed to call function`;

    class ServerClass {
      init() {
        this.api = this.lock(
          {
            test: (client, ...args) => {
              error = undefined;
            },
          },
          (client) => this.clients.includes(client),
        );
      }
      onDisconnect = () => (this.clients.length ? null : this.quit());
      teardown = () => done(error && new Error(error));
    }

    class ClientClass {
      onConnect = async () => {
        try {
          await this.server.api.test(1, 2, 3);
        } catch (e) {
          error = e.message;
        }
        this.disconnect();
      };
    }

    const factory = linkClasses(ClientClass, ServerClass);
    const { webServer } = factory.createServer();
    webServer.listen(0, () =>
      factory.createClient(`http://localhost:${webServer.address().port}`),
    );
  });
});
