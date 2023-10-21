import { linkClasses, ALLOW_SELF_SIGNED_CERTS } from "../library.js";
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
  it("can create plain http server", (done) => {
    class ServerClass {
      onDisconnect = () => (this.clients.length ? null : this.quit());
      teardown = () => done();
    }

    class ClientClass {
      onConnect = () => this.disconnect();
    }

    const factory = linkClasses(ClientClass, ServerClass);
    const { webserver } = factory.createServer();

    webserver.listen(0, () =>
      factory.createClient(`http://localhost:${webserver.address().port}`),
    );
  });

  it("can run with user-provided plain http server", (done) => {
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
    const { webserver } = factory.createServer(server);

    if (server !== webserver) {
      error = "different servers?";
    }

    webserver.listen(0, () =>
      factory.createClient(`http://localhost:${webserver.address().port}`),
    );
  });

  it("can create https server", (done) => {
    class ServerClass {
      onDisconnect = () => (this.clients.length ? null : this.quit());
      teardown = () => done();
    }

    class ClientClass {
      onConnect = () => this.disconnect();
    }

    const factory = linkClasses(ClientClass, ServerClass);
    const { webserver } = factory.createServer(httpsOptions);
    webserver.listen(0, () => {
      factory.createClient(
        `https://localhost:${webserver.address().port}`,
        ALLOW_SELF_SIGNED_CERTS,
      );
    });
  });

  it("rejects https server with self-signed certificate without ALLOW_SELF_SIGNED_CERTS", (done) => {
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
    const { server, webserver } = factory.createServer(httpsOptions);
    webserver.listen(0, () => {
      factory.createClient(`https://localhost:${webserver.address().port}`);
    });
  });

  it("can run with user-provided https server", (done) => {
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
    const { webserver } = factory.createServer(server);

    if (server !== webserver) {
      error = "different servers?";
    }

    webserver.listen(0, () => {
      factory.createClient(
        `https://localhost:${webserver.address().port}`,
        ALLOW_SELF_SIGNED_CERTS,
      );
    });
  });

  it("can run with user-provided plain http Express server", (done) => {
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

  it("can run with user-provided https Express server", (done) => {
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
});
