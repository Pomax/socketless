# How to use `socketless`

The `socketless` library works by creating proxy objects so that code can be written "as if" remote agents are actually just locally scoped objects, with `async` functions that can be called and their return `await`ed. Even though this library is an RPC-over-websockets solution, you will not need to write a single line of RPC or websocket code.

## The basics

The `socketless` library exports a convenience function, `linkClasses`, which can be used to create a client and server factory:

```js
import { linkClasses } from "socketless";
import { ClientClass, ServerClass } from "./my/classes.js";
const factory = linkClasses(ClientClass, ServerClass);
const { createClient, createServer } = factory;

const { server, webServer } = createServer();
webServer.listen(8000, () => {
  const client = createClient(`http://localhost:8000`);
});
```

And that's pretty much it all the boilerplate code `socketless` will contribute to your project.

Alternatively, you can also directly import the `createServer` and `createClient` functions, but note that these require you to specify the client and server class as argument:

```js
import { createClient, createServer } from "socketless";
import { ClientClass, ServerClass } from "./my/classes.js";

const { server, webServer } = createServer(ServerClass);
webServer.listen(8000, () => {
  const client = createClient(ClientClass, `http://localhost:8000`);
});
```

Generally, if you're creating servers and clients in the same script or codepath, `linkClasses` will be more convenient, whereas if you run server and client code in different processes or on different machines, using the dedicated functions means you don't have to load a class you don't need, i.e.:

```js
// a dedicated script
import { createServer } from "socketless";
import { ServerClass } from "./my/classes.js";
createServer(ServerClass).webServer.listen(8000);
```

plus

```js
// separate client script
import { createClient } from "socketless";
import { ClientClass } from "./my/classes.js";
createServer(ClientClass, `http://12.34.56.78:5678`);
```

## The basics: the browser as thin-client

Things are even simpler in the browser, as we can't create real clients or servers in the browser, only "browser clients" that act as thin-client frontend to the real client:

```js
import { createBrowserClient } from "./socketless.js";
createBrowserClient(BrowserClientClass);
```

And that's all the `socketless` boilerplate for in the browser.

## Servers

### Creating a server

As we've seen, creating a server is as easy as calling `createServer` and then listening for connections on its webServer:

```js
import { linkClasses } from "socketless";
import { ClientClass, ServerClass } from "./my/classes.js";
const { createServer } = linkClasses(ClientClass, ServerClass);
const PORT = process.env.PORT ?? 8000;
createServer().webServer.listen(PORT, () => {
  console.log(`server is running on port ${PORT}`);
});
```

Done, you're now running a server that is ready to accept client connections. But, in order to offer maximum flexibility, the `createServer` function has an optional single parameter that can be used to control the kind of web server we'll be using:

#### 1. Just give me a basic HTTP server

Without an argument, `createServer` will create a plain HTTP server to negotiate websocket "upgrade requests" (since all websocket connections start life as an HTTP call).

By default, that web server will not serve any sort of HTTP traffic outside of websocket upgrade calls, but you can assigned route handlers in order to serve regular content, using `.addroute(...)`:

```js
import { linkClasses } from "socketless";
import { ClientClass, ServerClass } from "./my/classes.js";
const factory = linkClasses(ClientClass, ServerClass);
const { webServer } = factory.createServer();
webServer.listen(0, () => {
  console.log(`server is running on port ${webServer.address().port}`);

  // Add a route handler for the root:
  webServer.addRoute(`/`, (req, res) => {
    res.writeHead(200, { "Content-Type": `text/html` });
    res.end(`<doctype html><html><body>It's a web page!</body></html>`);
  });
});
```

##### The `.addRoute` function

The `addRoute` function actually follows the Express.js middleware convention, so you can chain as many functions as you need, where any function can call `next()` to have the route handler move on to the next function:

```js
import { linkClasses} from "socketless";
import { ClientClass, ServerClass} from "./my/classes.js";
import { checkAuth } from "./users/auth.js";
import { userProfileMiddleware } from "./users/profiles.js";

const quickLog = (req, res, next) => {
  console.log(`[GET]: ${req.url}`);
  next();
};

const checkAuthMiddleware = (req, res, next) => {
  if (checkAuth(...)) {
    req.authenticated = true;
    next();
  }
};

const factory = linkClasses(ClientClass, ServerClass)
const { webServer } = factory.createServer()
webServer.listen(0, () => {
  console.log(`server is running on port ${webServer.address().port}`);

  // Add a route handler for the root:
  webServer.addRoute(`/`,
    quickLog,
    checkAuthMiddleware,
    userProfileMiddleware,
    (req, res) => {
      res.writeHead(200, { "Content-Type": `text/html` });
      const pageHTML = render(`index`, req.profile);
      res.end(pageHTML);
    }
  );
});
```

Note that unlike most web frameworks, `addRoute` is based on the lower-level Node `http` module and is not tied to a specific HTTP verb. You can examine `req.method` if you need to route functionality based on GET/POST/etc. However, `socketless` _will_ split off the URL query parameters as a `req.params` object (use ``.get(`...`)`` to retrieve individual values) as well as the POST/PUT body as `req.body` (as plain string data).

Also note that if you want to transport values across middleware functions, there is no predefined way to do so. However, [much like in Express](https://expressjs.com/en/guide/writing-middleware.html), you should be able to just tack your values onto the `req` object, provided the values you're storing don't conflict with the handful of predefined [http.ClientRequest](https://nodejs.org/api/https.html) properties:

```js
server.addRoute(
  `/`,
  (req, res, next) => {
    req.currentTime = Date.now();
    next();
  },
  (req, res) => {
    res.writeHead(200, { "Content-Type": `text/plain` });
    res.end(`time was ${req.currentTime}`);
  }
);
```

And should you ever need to remove a specific route handler, then `removeRoute(url)` will do that for you.

Now, this HTTP server can of course be presented to the outside world over HTTPS using an intermediary like [NGINX](https://www.nginx.com), but you could also...

##### The `.setAuthHandler` function

Additionally, we can restrict access to routes by setting an auth handler, which takes an `async` function with argument `request` that can be used to ensure that URLs only resolve for authorized users. For instance:

```js
webServer.addRoute(`/login`, (req, res) => {
  let content = ``;
  const token = req.method.toLowerCase() === `post` && verifyLogin(req);
  if (token) {
    // If the login was deemed good, set an auth token cookie
    res.writeHead(302, {
      "Set-Cookie": `authToken=${token}`
      url: `${req.protocol}://${req.get('host')}/lobby`;
    });
    content = `logged in`;
  } else {
    // If not, clear cookies and cache and let the user know
    res.writeHead(403, {
      "Clear-Site-Data": `"cache", "cookies"`,
    });
    content = `forbidden`;
  }
  res.end(content);
});

webServer.setAuthHandler(async (req) => {
  // only allow unrestricted access to our root URL
  if (req.url === `/`) return true;

  // As well as the login route, as long as that's a POST request:
  if (req.url === `/login` && req.method.toLowerCase() === `post`) return true;

  // Otherwise, verify that there is a auth cookie by examining the request headers:
  const cookies = req.headers.cookie?.split(`;`);
  if (!cookies) return false;

  const entries = cookies.map((s) => s.split("=").map((v) => v.trim()));
  const { authToken } = Object.fromEntries(entries);
  return validAuthToken(authToken);
});
```

This allows custom locking both for the regular server, as well as webclient servers, which means this allows the main server to set login tokens that can then be used by client webservers to verify that browser connections are from a logged in user rather than "anyone with the URL".

#### 2. use HTTPS by providing your own certificate

In order to make socketless run an HTTPS server, you can provide your own `key` and `cert` to the factory function:

```js
import { linkClasses } from "socketless";
import { ClientClass, ServerClass } from "./my/classes.js";
const factory = linkClasses(ClientClass, ServerClass);
const { webServer } = factory.createServer({
  key: `...`,
  cert: `...`,
});
webServer.listen(0, () => {
  console.log(`server is running on port ${webServer.address().port}`);
});
```

This will cause `socketless` to run an https, rather than http, server.
Note that these can, of course, be self-signed certs, using something like [pem](https://www.npmjs.com/package/pem):

```js
import pem from "pem";
import { linkClasses } from "socketless";
import { ClientClass, ServerClass } from "./my/classes.js";
const factory = linkClasses(ClientClass, ServerClass);

const httpsOptions = await new Promise((resolve, reject) => {
  pem.createCertificate(
    {
      days: 1,
      selfSigned: true,
    },
    (err, { clientKey: key, certificate: cert }) => {
      if (err) return reject(err);
      resolve({ key, cert });
    }
  );
});

const { webServer } = factory.createServer(httpsOptions);
webServer.listen(443);
```

However, if you're using self-signed certs, you're going to run into a bunch of delightful security gotchas, so you'll want to make sure to create your clients with the `ALLOW_SELF_SIGNED_CERT` flag. We'll talk more about that in the clients section.

And of course, let's be fair: you know how to run your own server, it's kind of silly to use a limited-functionality Node server based on the http/https packages, so you've probably written a million [express servers](https://expressjs.com) in your life and you'd `socketless` to just use that. So... let's do that:

#### 3. using an Express server

You know how an express server works, so: set one up, and then pass that into the `createServer` function as part of your listen call:

```js
import { linkClasses } from "socketless";
import { ClientClass, ServerClass } from "./my/classes.js";
const factory = linkClasses(ClientClass, ServerClass);

const app = express();

app.get(`/`, (_, res) => {
  res.render(`index`, { title: `our page` });
});

const webServer = app.listen(0, async () => {
  factory.createServer(webServer);
});
```

And of course again, you're almost certainly going to outsource HTTPS to NGINX or the like, but if you absolutely need to run your own express server over HTTPS, then we can do that too. [As per the Express docs](http://expressjs.com/en/5x/api.html#app.listen), we'll need to create our own HTTPS server again, so let's do that:

#### 4. Express on HTTPS

(To be fair, you wouldn't do this. But you can. And you'd do it like this)

```js
import pem from "pem";
import { linkClasses } from "socketless";
import { ClientClass, ServerClass } from "./my/classes.js";
const factory = linkClasses(ClientClass, ServerClass);

const app = express();

app.get(`/`, (_, res) => {
  res.render(`index`, { title: `our page` });
});

const httpsOptions = await new Promise((resolve, reject) => {
  pem.createCertificate(
    {
      days: 1,
      selfSigned: true,
    },
    (err, { clientKey: key, certificate: cert }) => {
      if (err) return reject(err);
      resolve({ key, cert });
    }
  );
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

### Prespecified server instance properties

Any function that isn't the constructor has access to two special properties:

- `this.clients`, an array of clients, each a socket proxy of the connected client
- `this.quit()`, a method to close all connections and shut down the server.

### All server functions start with `client`

All server functions get called with the calling client as first argument, so you need to write your functions to take this into account, as the same is not true for client class functions:

```js
const ONE_WEEK_IN_MS = 1000 * 3600 * 24 * 7;

class ServerClass {
  // note the "client" as first argument:
  async declareLoss(client) {
    this.clients.forEach((c) => c.playerDeclaredLoss(client.id));
  }
}

class ClientClass {
  async onConnect() {
    // note that we're not passing ourselves as an arguments here,
    // the server already knows who makes the call based on the
    // fact that we already know which web socket was used.
    this.server.declareLoss();
  }
  async playerDeclaredLoss(id) {
    // also note that (perhaps obviously) there is
    // no "client" argument on the client side.
  }
}
```

### Keeping functions/properties off the network

Any instance function that you want to explicitly "lock off" from client access can simply be marked as [private function](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Classes/Private_class_fields):

```js
class ServerClass {
  // private function, only accessible through `this`
  async #reallyStartGame(id) {
    this.gameManager.start(id);
  }

  // normal, public function
  async startGame(client) {
    // fall through to our private function
    this.#reallyStartGame(client.id);
  }
  ...
}

class ClientClass {
  async onConnect() {
    // This works:
    this.server.startGame();

    // this throws through socketless, because there is no function by that name:
    this.server.reallyStartGame();

    // And this is a SyntaxError, and your code won't even be allowed to run until you fix this:
    this.server.#reallyStartGame();
  }
}
```

Note that while clients can only call functions, and so do not have access to primitive properties, they _can_ call functions _on_ those properties. As such, be careful how you expose data.

For example, **do not do this**:

```js
class ServerClass {
  constructor() {
    // Uh oh, this is now accessible to any client...
    this.gameManager = new GameManager(this);
  }
  async startGame(client) {
    this.gameManager.start(client.id);
  }
  ...
}

class ClientClass {
  async onConnect() {
    // Oh no! Our games! O_O
    this.server.gameManager.games.splice(0,Number.MAX_SAFE_INT);
  }
}
```

Instead, treat your server purely as an API layer between your "real" program, and your clients, with out-of-class variables for the things you need to work with but don't want shared.

```js
// Our actual program
import { GameManager } from "src/game/game-manager.js";
let gameManager;

// Our server is just an RPC gateway into that program,
// exposing exactly *nothing* to clients:
class ServerClass {
  async init() {
    gameManager = new GameManager();
    gameManager.init();
  }
  async onConnect(client) {
    gameManager.addUser(client.id);
  }
  async createGame(client) {
    // Let's imagine that this throws if there's already a game, etc.
    let newGame = gameManager.createGame(client.id);
    this.clients.forEach(client => client.gameCreated(newGame));
  }
  ...
}

class ClientClass {
  async onConnect() {
    // This will throw, because the server doesn't have a `.gameManager` property.
    this.server.gameManager.games.splice(0,Number.MAX_SAFE_INT);

    // There is no way for clients to directly access anything outside of the
    // server's instance scope.Instead, they'll have to use our API:
    try {
      await this.server.createGame();
    } catch (e) {
      console.error(e);
    }
  }
  async gameCreated(game) {
    if (game.owner === this.id) {
      ...
    }
    ...
  }
  ...
}
```

Now clients cannot access the `gameManager` as a server property, and they won't be able to cheat!

Also note that we did _not_ use the following code:

```javascript
// This is *not* what we want:
import { GameManager } from "src/game/game-manager.js";
let gameManager = new GameManager();
    gameManager.init();

class ServerClass {
  async onConnect(client) {
    ...
  }
  ...
}
```

The reason for this is that `linkClasses` needs both classes in order for `socketless` to do its job, and you don't want any code that's only meaningful on the server to get run on the client purely by importing the server class (or vice versa). Instead of declaring and initializing out-of-class globals (or, "module globals" really), declare them out-of-class and then _assign_ them in the `init()` function.

### Finer control: per-client access

In order to allow you to control who can access which functions/properties, you can also `lock` server instance properties. Take the following code:

```javascript
class ServerClass {
  init() {
    this.test = {
      run: (client, ...args) => {
        console.log(`this log will never run`);
      },
    };
  }
}

class ClientClass {
  onConnect = async () => {
    await this.server.test.run(1, 2, 3);
  };
}
```

If we want to restrict who may call the server's `test.run()` function, we can lock this function down, with a reference to an explicit unlock function that takes a `client` as argument and either returns `true` if that client is permitted access, or `false` if it is not:

```javascript
class ServerClass {
  init() {
    this.test = this.lock(
      {
        run: (client, ...args) => {
          console.log(`this log will never run`);
        },
      },
      (client) => this.allowClient(client)
    );
  }
  allowClient() {
    // universal "no permission"
    return false;
  }
}

class ClientClass {
  onConnect = async () => {
    try {
      await this.server.test.run(1, 2, 3);
    } catch (e) {
      // This will catch "no access permission on server:test:run for client"
    }
  };
}
```

With the above code, and an unlock function that indiscriminantly disallows access, we have effectively turned this property into a private property. However, if you want to only give access to clients that you know you can trust (e.g. they passed an authentication step), we can grant certain clients permission, while keeping others from calling functions:

```javascript
class ServerClass {
  init() {
    this.test = this.lock(
      {
        run: (client, ...args) => {
          console.log(`this will run for authenticated clients`);
        },
      },
      (client) => this.authenticatedClients.includes(client)
    );
  }
  authenticate(client, username, password) {
    if (!passesAuth(username, password)) return false;
    this.authenticatedClients.push(client);
    return true;
  }
}

class ClientClass {
  onConnect = async () => {
    const authenticated = (this.authenticated = await this.server.authenticate(
      `username`,
      `password`
    ));
    if (authenticated) {
      // this won't throw now, although a try/catch might still be a good idea!
      await this.server.test.run(1, 2, 3);
    }
  };
}
```

(though: remember that `client` is a proxy object, so even though you might be tempted to do something like `client.authenticated = true`, this will lead to all kinds of fun bugs)

## Clients

### Creating a client

Creating clients is decidedly simpler than creating servers:

```js
import { linkClasses } from "socketless";
import { ClientClass, ServerClass } from "./my/classes.js";
const factory = linkClasses(ClientClass, ServerClass);

const serverURL = `http://...`;
const client = factory.createClient(serverURL);
```

The only variation on this is when the serverURL is an `https` URL and we know that a self-signed certificate is being used, in which case we need to make sure to pass `ALLOW_SELF_SIGNED_CERTS` as second argument:

```js
import { linkClasses, ALLOW_SELF_SIGNED_CERTS } from "socketless";
import { ClientClass, ServerClass } from "./my/classes.js";
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

Mirroring the server, clients have a special `this.server` that can be used to call server functions as if they were local calls in any function outside of the constructor.

And of course, the same rules for keeping functions and properties off the network apply to clients.

## WebClients

Regular clients are self-contained, but if you want a client with a browser front-end, you're going to have to build a web client. Web clients are an extension on regular clients, and are created with the `createWebClient` function, yielding not just a client, but also that client's own web server for connecting a browser to:

```js
import url from "url";
const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

import { linkClasses } from "socketless";
import { ClientClass, ServerClass } from "./my/classes.js";
const factory = linkClasses(ClientClass, ServerClass);

const serverURL = `http://...`;
const { client, clientWebServer } = createWebClient(
  serverUrl,
  `${__dirname}/public`
);
clientWebServer.listen(0, () => {
  console.log(
    `client ready for browser connections on port ${
      clientWebServer.address().port
    }`
  );
});
```

As you can see, the `createWebClient` function doesn't just take the server URL, but also a string argument pointing at the directory that will host all the static assets such as your `index.html`, css files, images, etc.

### Defining a web-enabled client class

The web client class is a stand-in for the client class, with a few more events and some extra pre-defined instance properties:

```js
class WebClientClass {
  async onConnect(client) {
    // This event is triggered after a client has
    // successfully connected to the server.
  }

  async onDisconnect(client) {
    // This event is triggered after a client has
    // disconnected from the server.
  }

  async onBrowserConnect(browser) {
    // This event is triggered after the browser
    // connects to this client's web server.
  }

  async onBrowserDisconnect() {
    // This event is triggered after the browser
    // disconnects from this client's web server.
  }

  async onQuit() {
    // This event is triggered before this client's
    // web server and websocket server get shut down.
  }

  async teardown() {
    // This event is triggered after this client's
    // web server and websocket server get shut down.
  }
}
```

Any function except for the constructor has access to `this.browser`, a proxy of the browser. However, unlike the client and server proxies, calls made on `this.browser` do _not_ time out, they remaining in a waiting state until the browser returns a value.

### Web client state synchronization

Web clients have a special `this.state` property object that is used to synchronize data between the client and connected browsers. Any data that should be reflected in the browser should be put on that. Changes to the state are dealt with as JSON diffs, so it doesn't matter how deeply nested you make the state, but if you're putting something onto the state object that can't be JSON serialized (symbols, functions, etc.) you're likely to run into errors.

### Creating a page for the browser to load

When the browser connects to a web client it will be served whatever's in the `index.html` file in your assets directory. As a starting point, a minimal index page would look like this:

```html
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>...your title here...</title>
    <meta
      name="viewport"
      content="width=device-width, height=device-height, initial-scale=1.0"
    />
    <script src="./index.js" type="module" async></script>
    <link rel="stylesheet" href="./index.css" />
  </head>
  <body>
    ...your content here...
  </body>
</html>
```

With a minimal `index.js` containing the `socketless` import and creation call for the browser portion of the web client (see next section).

## The browser

The browser can load `socketless` as a `./socketless.js` script relative to the web root, which exports a single function `createBrowserClient` with which to connect to the real client:

```js
import { createBrowserClient } from "./socketless.js";
import { BrowserClientClass } from "./ui.js";
const instance = createBrowserClient(BrowserClientClass);
```

(Note that you do not need to place a `socketless.js` file in your assets directory: the client's web serer comes with special route handling for the request)

This builds an instance of the provided class, with a `this.server` property that lets the browser (think it) communicate(s) with the server (in reality it's getting proxied by the real client), as well as a `this.socket` that is the websocket connection to the real client. You should almost _never_ need to use it, but for the rare few times that you do, it's there. At most you'd use it to gracefully disconnect, but to make sure you don't, `this.disconnect()` already exists, too (with a matching `this.reconnect()` to reestablish a connection. Browsers also have a `this.connected` flag to indicate connection status).

Browser client classes may have an `init()` function, in which case that function will be called at the end of the `createBrowserClient` pass.

The browser is kept in sync with the client via the `this.state` variable, and browser client classes _should_ have an `update(prevState)` function, which gets called every time the state gets synced with the client. This is a one-way sync: the browser should be considered "a UI on top of the client's state", where the client is the _actual_ authority when it comes to what its state is. Do not write code that modifies `this.state` in the browser, treat it as a read-only variable, with the `update(prevState)` function being the signal that the state got updated, with the current state being `this.state` and the previous state being the `prevState` argument.

### Authentication

The `socketless` library comes with limited authentication built in, in the form on a secret identifier. The main thing to bearing in mind is that only the server should be the authority when it comes to what constitutes an authenticated user.

To use this form of authentication:

1. Give the server a login API using HTTP end points, that can be posted to from the server's main page.
2. On a successful log-in, make the server spin up a new web client and tell it to connect to the server URL with `?sid=...` as query argument.
3. Give the authenticated user a link to their webclient's url that includes that same `?sid=...` query parameter.

When the user clicks on this web client link, the codebase will perform an `sid` comparison both for the browser request for `socketless.js` _as well as_ for the websocket upgrade request (so folks can't just write their own websocket code and bypass the check built into the `socketless.js` browser library).

As an example:

```js
const { ClientClass, ServerClass } = ...
const factory = linkClasses(ClientClass, ServerClass);
const { webServer } = factory.createServer();

webServer.listen(0, () => {
  const port = webServer.address().port;
  const serverURL = `http://localhost:${port}`;

  // generate a random, secret identifier and pass that into the web client:
  const sid = Math.random().toString().substring(2);
  const { client, clientWebServer } = factory.createWebClient(
    `${serverURL}?sid=${sid}`, // <-- note the `sid` query argument here
    `${__dirname}/webclient/public`,
  );

  let clientURL = `pending...`;

  webServer.addRoute(`/`, (req, res) => {
    res.writeHead(200, { "Content-Type": `text/html` });
    res.end(`<!doctype html>
      <html>
        <body>
          <a href="${clientURL}">${clientURL}</a>
        </body>
      </html>
    `);
  });

  clientWebServer.listen(0, async () => {
    const clientPort = clientWebServer.address().port;
    clientURL = `http://localhost:${clientPort}?sid=${sid}`;
  });
});
```

This sets up the main server, with an index page on the `/` URL that has a link to the web client's URL, including the secret identifier.

And then on the webclient side, we make sure that our `public` dir has an index.html that loads some JS that looks like:

```js
import { BrowserClientClass } from "./ui.js";

...

// dynamic import for socketless.js so that we can pass the URL search parameters through
import(`./socketless.js${location.search}`)
  // if we passed in the correct secret identifier, the `socketless.js` library will get loaded in
  .then((socketless) => {
    // from here, the process is identical to if we were to use socketless without authentication.
    const { createBrowserClient } = socketless;
    createBrowserClient(BrowserClientClass);
  })
  // if we didn't, we'll get an error.
  .catch((e) => console.error(e));
```

A little bit more work compared to running unauthenticated, but at least most of the heavy lifting is done by the `socketless` library, so the extra code required to use `sid` verification is only a few more lines of code.

### How to "quit"

While you can disconnect the browser from the web client with `this.disconnect()`, the `socketless` library does not come with a built in way to _shut down_ the web client from the browser, for security reasons.

While this means you need to implement this functionality yourself, the fact that the client is a web server makes that job relatively straight forward, with the recommended way to achieve this being to add a URL endpoint that the browser can navigate to and have that trigger a client shutdown:

```js
...

const { client, clientWebServer } = createWebClient(...);

clientWebServer.addRoute(`/quit`, (req, res) => {
  res.end("web client quit", () => {
    client.quit();
  });
});

clientWebServer.listen(0, () => {
  const PORT = clientWebServer.address().port;
  const url = `http://localhost:${PORT}`;
  console.log(`web client running on ${url}`);
});
```

The browser can then trigger this route using a page navigation to `/quit` or ``fetch(`/quit`)`` call. For added security, you probably also want to make sure only the connected browser is allowed to call this route, by dynamically generating the quit route in the client class as part of browser connection, and then remove it again during browser disconnects:

```js
class ClientClass {
  ...
  async onBrowserConnect(browser) {
    this.state.quitURL = `/${uuid.v4()}`
    this.webServer.addRoute(this.state.quitURL, (req, res) => {
      res.end("Thank you, come again!", () => {
        this.quit();
      });
    });
  }
  async onBrowserDisconnect(browser) {
    this.webServer.removeRoute(this.state.quitURL);
  }
  ...
}
```

And then because of the state syncing mechanism, your browser code will be able to use `this.state.quitURL` to call the correct URL that shuts the real client down.

### Connecting with multiple browsers

Web clients are set up to allow a single browser to connect, and reject additional browser connections until the current connection gets closed. Rather that connecting multiple browsers to a single web client, give each user their own web client instead.

### Examples of browser classes

It bears repeating that your browser is purely a UI whose job it is to render and present a UI based on the current client state. As such, your browser client class will almost certainly want to hand off that work to some UI framework, so let's look at how you'd use `socketless` in combination with some of the popular frameworks.

#### Plain ES

The OG framework, plain ES is not exactly great at being a UI framework, but it _is_ great at letting you implement only what you need and not a single line more.

```js
// let's imagine we've got a <player-bank> and <game-tile> custom element defined.
const create = tag => document.createElement(tag);

function renderPage(state) {
  document.body.innerHTML = ``;
  state.players.forEach((player, pos) => document.body.append(renderPlayer(player, pos)));
}

function renderPlayer(player, position) {
  const playerBank = create(`player-bank`);
  playerBank.setAttribute(`position`, position);
  player.tiles.forEach(tile => playerBank.append(renderTile(tile)));
  return playerBank;
}

function renderTile(tile) {
  const tile = create(`game-tile`);
  tile.setAttribute(`value`, tile.value);
  return tile;
}

...

// And then we're basically doing nothing other than getting our update pushed into our own code!
export class WebUI {
  update() {
    renderPage(this.state);
  }
}
```

Alternatively, for maximum flexibility, we can also simply make our browser client class an event emitter, so that anything can listen for updates:

```js
import { createBrowserClient } from "./socketless.js";

export const SOCKETLESS_EVENT_NAME = `socketless-update`;

const signal = (prevState, state) =>
  window.dispatchEvent(
    new Event(SOCKETLESS_EVENT_NAME, {
      detail: {
        prevState,
        state,
      },
    })
  );

createBrowserClient(
  class {
    update(prevState) {
      signal(prevState, this.state);
    }
  }
);
```

And that's it, anything can now listen to the `window` level `socketless-update` event, and get the updated state as `event.detail.state`, with a reference to the previous state encoded as `event.detail.prevState`.

#### React

You will need to mark `socketless.js` as an "external" library to make sure your bundler does not try to bake it into your app bundle. It _must_ be loaded at runtime in the browser.

```jsx
import ReactDOM from "react-dom";
import { useEffect, useState } from "react";
import { UI } from "./components/ui";
import { createBrowserClient } from "./socketless.js";

function App() {
  const [clientState, setClientState] = useState({});

  useEffect(() => {
    createBrowserClient(
      class {
        update() {
          setClientState(this.state);
        }
      }
    );
  }, []);

  return <UI clientState={clientState} />;
}

const root = ReactDOM.createRoot(document.body);
root.render(<App />);
```

And with that, our App will start up, and one-time create the browser client such that every time it receives an update, it calls `setClientState` with the new client state, which will update the App's `clientState` variable, which will in turn trigger a rerender in any downstream components we defined.

#### Vue

The direct way to tie `socketless` into Vue is by using the above event approach, and simply tapping into that event on the Vue side by using a `v-on:socketless-update` attribute.

Alternatively, you can also use your app's `mounted` functionality: declare a `state` variable in `data()`, then create the browser client in `mounted()` and have that update the Vue app's `state` variable:

```js
import { createBrowserClient} from "./socketless.js";

...

export default {
  name: `...`,
  data() {
    return {
      state: {}
    }
  },
  mounted() {
    const vueAppp = this;
    createBrowserClient(class {
      update() {
        vueAppp.state = this.state;
      }
    });
  }
}
```

#### Angular

To get data into your Angular app, use the above-mentioned event approach, and then use `@HostListener` ([documented here](https://angular.io/guide/attribute-directives#handling-user-events)) to capture those in the place you want to capture them:

```js
import { HostListener } from "@angular/core".
import { SOCKETLESS_EVENT_NAME} from "./browser-client-class.js";

export class MyComponent {
  ...

  @HostListener(`window:${SOCKETLESS_EVENT_NAME}`, [`$event.detail`])
  onUpdate({ prevState, state}) {
    console.log(`we can now do something with state and/or prevState`);
  }
}
```
