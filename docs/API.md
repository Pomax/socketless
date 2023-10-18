# General documentation

This document covers how to use this library.

## Socketless

Create a factory using the `linkClasses` function:

```js
import { linkClasses} fom "socketless";
import { ClientClass, ServerClass} from "./my/classes.js";
const factory = linkClasses(ClientClass, ServerClass)
```

## Socketless in the browser

There is no need to build a factory in the browser, as there is only one function that can be called:

```js
import { createBrowserClient} fom "./socketless.js";
createBrowserClient(BrowserClientClass)
```

## Servers

### Creating a server

```js
import { linkClasses} fom "socketless";
import { ClientClass, ServerClass} from "./my/classes.js";
const factory = linkClasses(ClientClass, ServerClass)
const server = factory.createServer()
server.listen(0, () => {
    console.log(`server is running on port ${server.address().port}`);
});
```

#### Controlling the type of web server being used

In order to offer maximum flexibility, the `createServer` function has an optional single argument, which controls the web server behaviour:

##### 1. Just give me a basic HTTP server

Without an argument, `createServer` will create a plain HTTP server to negotiate websocket "upgrade requests" (since all websocket connections start life as an HTTP call).

By default, the server will not serve any sort of content on HTTP, the only reason for the web server is to mediate websocket connections. However, the server can be assigned route handling in order to serve regular content, using `server.addroute`:

```js
import { linkClasses} fom "socketless";
import { ClientClass, ServerClass} from "./my/classes.js";
const factory = linkClasses(ClientClass, ServerClass)
const server = factory.createServer()
server.listen(0, () => {
  console.log(`server is running on port ${server.address().port}`);

  // Add a route handler for the root:
  server.addRoute(`/`, (req, res) => {
    res.writeHead(200, { "Content-Type": `text/html` });
    res.end(`<doctype html><html><body>It's a web page!</body></html>`);
  },
});
```

Now, this HTTP server can of course be presented to the outside world over HTTPS using an intermediary like [NGINX](https://www.nginx.com), but you could also...

##### 2. use HTTPS by providing your own certificate

In order to make socketless run an HTTPS server, you can provide your own `key` and `cert` to the factory function:

```js
import { linkClasses} fom "socketless";
import { ClientClass, ServerClass} from "./my/classes.js";
const factory = linkClasses(ClientClass, ServerClass)
const server = factory.createServer({
    key: `...`,
    cert: `...`
})
server.listen(0, () => {
    console.log(`server is running on port ${server.address().port}`);
});
```

This will cause `socketless` to run an https, rather than http, server.

Note that these can, of course, be self-signed certs, using something like [pem](https://www.npmjs.com/package/pem):

```js
import pem from "pem";
import { linkClasses} fom "socketless";
import { ClientClass, ServerClass} from "./my/classes.js";
const factory = linkClasses(ClientClass, ServerClass)

const httpsOptions = await new Promise((resolve, reject) => {
  pem.createCertificate({
    days: 1,
    selfSigned: true
  },
  (err, { clientKey: key, certificate: cert}) => {
    if (err) return reject(err);
    resolve({ key, cert });
  });
});

const server = factory.createServer(httpsOptions)
server.listen(443);
```

However, if you're using self-signed certs, you're going to run into a bunch of delightful security gotchas, so you'll want to make sure to create your clients with the `ALLOW_SELF_SIGNED_CERT` flag. We'll talk more about that in the clients section.

Of course, let's be fair: you know how to run your own server, and so you're using an [express server](https://expressjs.com/) and you'd like socketless to just use that. So... let's do that:

##### 3. using an Express server

You know how an express server works, so: set one up, and then pass that into the `createServer` function as part of your listen call:

```js
import { linkClasses} fom "socketless";
import { ClientClass, ServerClass} from "./my/classes.js";
const factory = linkClasses(ClientClass, ServerClass);

const app = express();

app.get(`/`, (_, res) => {
  res.render(`index`, { title: `our page` });
});

const server = app.listen(0, async () => {
  factory.createServer(server);
});
```

And yeah you're almost certainly going to outsource HTTPS to NGINX or the like, but if you absolutely need to run your own HTTPS express server, we can do that too. As per the Express docs, we'll need to create our own HTTPS server, so let's do that:

##### 4. Express on HTTPS

To be fair, you wouldn't do this. But you can. And you'd do it like this:

```js
import pem from "pem";
import { linkClasses} fom "socketless";
import { ClientClass, ServerClass} from "./my/classes.js";
const factory = linkClasses(ClientClass, ServerClass);

const app = express();

app.get(`/`, (_, res) => {
  res.render(`index`, { title: `our page` });
});

const httpsOptions = await new Promise((resolve, reject) => {
  pem.createCertificate({
    days: 1,
    selfSigned: true
  },
  (err, { clientKey: key, certificate: cert}) => {
    if (err) return reject(err);
    resolve({ key, cert });
  });
});

const server = https.createServer(httpsOptions, app);
server.listen(0, async () => {
  factory.createServer(server);
});
```

### Defining a server class

With all of that covered, a server class is just a plain ES class that doesn't need to implement _anything_ in order to work. All the necessary code gets taken care of by `socketless`, but you generally want to implement at least _some_ things that give you more control over your server.

```js
class ServerClass {
  async onConnect(client) {
    // This event is triggered after a client has
    // successfully connected to the server.
  }

  async onDisconnect(client) {
    // This event is triggered after a client has
    // disconnected from the server.
  }

  async onQuit() {
    // This event is triggered before the local
    // web server and websocket server shut down.
  }

  async teardown() {
    // This event is triggered after both the web
    // server and web socket server shut down.
  }
}
```

In addition to this, _any function you declare on the class will be RPC-accessible_ meaning that clients will be able to call those functions. As such, you don't want to declare "convenience" functions on your server class, and you'll want to declare those _outside_ the class instead. For example, you might be tempted to write the following code:

```js
class ServerClass {
  constructor() {
    this.gameManager = new GameManager(this);
  }

  startGame(client) {
    this.gameManager.start(client.id);
  }
}
```

However, this way clients can just bypass your API and call `this.server.gameManager.start(1)` directly, themselves... which we don't want! Instead, extra care is required when structuring code:

```js
const gameManager = new GameManager();

class ServerClass {
  constructor() {
    gameManager.init(this);
  }
  startGame(client) {
    gameManager.start(client.id);
  }
}
```

Now clients cannot access the `gameManager` as a server property, and they won't be able to cheat!

Also note that any function that isn't the constructor has access to two special properties:

- `this.clients`, an array of clients, each a socket proxy of the connected client
- `this.quit()`, a method to close all connections and shut down the server.

## Clients

### Creating a client

Creating clients is decidedly simpler than creating servers:

```js
import { linkClasses } fom "socketless";
import { ClientClass, ServerClass} from "./my/classes.js";
const factory = linkClasses(ClientClass, ServerClass);

const serverURL = `http://...`;
const client = factory.createClient(serverURL);
```

The only variation on this is when the serverURL is an `https` URL and we know that a self-signed certificate is being used, in which case we need to make sure to pass `ALLOW_SELF_SIGNED_CERTS` as second argument:

```js
import { linkClasses, ALLOW_SELF_SIGNED_CERTS } fom "socketless";
import { ClientClass, ServerClass} from "./my/classes.js";
const factory = linkClasses(ClientClass, ServerClass);

const serverURL = `https://...`;
const client = factory.createClient(serverURL, ALLOW_SELF_SIGNED_CERTS);
```

### Defining a client class

Much like the server class, client classes are just standard ES classes, with a connect and disconnect event handler you may want to implement:

```js
class ClientClass {
  async onConnect(client) {
    // This event is triggered after a client has
    // successfully connected to the server.
  }

  async onDisconnect(client) {
    // This event is triggered after a client has
    // disconnected from the server.
  }
}
```

Much like the server, clients have a special `this.server` that can be used to call server functions as if they were local calls.

## WebClients

### Creating a web-enabled client

`{client, clientWebServer } = createWebClient` + options

### Defining a web-enabled client class

- architecture info

## The browser

### Connecting the browser to a web client

`createBrowserClient` + options

### Writing a browser UI

- architecture info

#### Plain ES

#### Vue

#### React

#### Angular

#### Svelte

#### ???
