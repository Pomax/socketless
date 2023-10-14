import { generateClientServer } from "../src/index.js";
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

const ALLOW_SELF_SIGNED_CERTS = true;

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

    const factory = generateClientServer(ClientClass, ServerClass);
    const server = factory.createServer();

    server.listen(0, () =>
      factory.createClient(`http://localhost:${server.address().port}`),
    );
  });

  it("can run with user-provided plain http server", (done) => {
    class ServerClass {
      onDisconnect = () => (this.clients.length ? null : this.quit());
      teardown = () => done();
    }

    class ClientClass {
      onConnect = () => this.disconnect();
    }

    const factory = generateClientServer(ClientClass, ServerClass);
    const webserver = http.createServer();
    const server = factory.createServer(webserver);
    expect(server).toBe(webserver);

    server.listen(0, () =>
      factory.createClient(`http://localhost:${server.address().port}`),
    );
  });

  it("can create https server", (done) => {
    expect(httpsOptions).toBeDefined();

    class ServerClass {
      onDisconnect = () => (this.clients.length ? null : this.quit());
      teardown = () => done();
    }

    class ClientClass {
      onConnect = () => this.disconnect();
    }

    const factory = generateClientServer(ClientClass, ServerClass);
    const server = factory.createServer(httpsOptions);
    server.listen(0, () => {
      factory.createClient(
        `https://localhost:${server.address().port}`,
        ALLOW_SELF_SIGNED_CERTS,
      );
    });
  });

  it("can run with user-provided https server", (done) => {
    expect(httpsOptions).toBeDefined();

    class ServerClass {
      onDisconnect = () => (this.clients.length ? null : this.quit());
      teardown = () => done();
    }

    class ClientClass {
      onConnect = () => this.disconnect();
    }

    const factory = generateClientServer(ClientClass, ServerClass);
    const webserver = https.createServer(httpsOptions);
    const server = factory.createServer(webserver);
    expect(server).toBe(webserver);
    server.listen(0, () => {
      factory.createClient(
        `https://localhost:${server.address().port}`,
        ALLOW_SELF_SIGNED_CERTS,
      );
    });
  });

  it("can run with user-provided plain http Express server", (done) => {
    class ServerClass {
      onDisconnect = () => (this.clients.length ? null : this.quit());
      teardown = () => {
        done();
      };
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
      expect(data).toBe(ROUTE_TEXT);

      // then test socketless functionality
      const factory = generateClientServer(ClientClass, ServerClass);
      factory.createServer(server);
      factory.createClient(serverURL);
    });
  });

  it("can run with user-provided https Express server", (done) => {
    class ServerClass {
      onDisconnect = () => (this.clients.length ? null : this.quit());
      teardown = () => done();
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
      expect(result).toBe(ROUTE_TEXT);

      // then test socketless functionality
      const factory = generateClientServer(ClientClass, ServerClass);
      factory.createServer(server);
      factory.createClient(
        `https://localhost:${server.address().port}`,
        ALLOW_SELF_SIGNED_CERTS,
      );
    });
  });
});
