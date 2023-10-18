# API documentation

This document covers how to use this library.

## Socketless

Create a factory using the `linkClasses` function:

```js
import { linkClasses} fom "./socket;ess.js";
import { ClientClass, ServerClass} from "./my/classes.js";
const factory = linkClasses(ClientClass, ServerClass)
```

## Socketless in the browser

There is no need to build a factory in the browser, as there is only one function that can be called:

```js
import { createBrowserClient} fom "./socket;ess.js";
createBrowserClient(BrowserClientClass)
```

## Servers

### Creating a server

```js
import { linkClasses} fom "./socket;ess.js";
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

Without an argument, `createServer` will create a plain HTTP server to negotiate websocket "upgrade requests" (as all websockets start life as an HTTP call).

By default, the server will not serve any sort of content on HTTP, the only reason for the web server is to mediate websocket connections. However, the server can be assigned route handling in order to serve regular content, using `server.addroute`:

```js
import { linkClasses} fom "./socket;ess.js";
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
import { linkClasses} fom "./socket;ess.js";
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

This will cause `socketless` to run an https rather than http server.

Note that these can, of course, be self-signed certs, using something like [pem](https://www.npmjs.com/package/pem):

```js
import { linkClasses} fom "./socket;ess.js";
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

However, if you're using self-signed certs, you're going to run into a bunch of delightful security gotchas, so you'll want to make sure to create your clients with the `ALLOW_SELF_SIGNED_CERT` flag. We'll talk more about this in the clients section.

Of course, let's be fair: you know how to run your own server, and so you're using an [express server](https://expressjs.com/) and you'd like socketless to just use that. So... let's do that:

##### 3. using an Express server

You know how an express server works, so: set one up, and then pass that into the `createServer` function as part of your listen call:

```js
import { linkClasses} fom "./socket;ess.js";
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

And yeah you're almost certainly going to outsource HTTPS but if you absolutely need to run your own HTTPS express server, we can do that too. As per the Express docs, we'll need to create our own HTTPS server, so let's do that:

##### 4. Express on HTTPS

To be fair, you wouldn't do this. But you can. And you'd do it like this:

```js
import { linkClasses} fom "./socket;ess.js";
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

With all of that covered, a server class is just a plain ES class.

## Clients

### Creating a client

`const client = createClient` + options

### Defining a client class

- architecture info

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
