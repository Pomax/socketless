# How to use `socketless`

The `socketless` library works by creating proxy objects so that code can be written "as if" remote agents are actually just locally scoped objects, with `async` functions that can be called and their return `await`ed. Even though this library is an RPC-over-websockets solution, you will not need to write a single line of RPC or websocket code.

## The basics

The `socketless` library exports a single function, `linkClasses`, which is used to create a client and server factory:

```js
import { linkClasses} fom "socketless";
import { ClientClass, ServerClass} from "./my/classes.js";
const factory = linkClasses(ClientClass, ServerClass)
const { createClient, createServer } = factory;
```

And that's pretty much it all the boilerplate code `socketless` will contribute to your project.

## The browser basics

Things are even simpler in the browser, as we can't create real clients or servers in the browser, only "browser clients" that act as thin-client frontend to the real client:

```js
import { createBrowserClient} fom "./socketless.js";
createBrowserClient(BrowserClientClass)
```

And that's all the `socketless` boilerplate for in the browser.

## Servers

### Creating a server

Creating a server is as easy as calling `createServer` and then listening for connections:

```js
import { linkClasses} fom "socketless";
import { ClientClass, ServerClass} from "./my/classes.js";
const { createServer } = linkClasses(ClientClass, ServerClass)
const PORT = process.env.PORT ?? 8000;
createServer().listen(PORT, () => {
    console.log(`server is running on port ${PORT}`);
});
```

Done, you're now running a server that is ready to accept client connections. But, in order to offer maximum flexibility, the `createServer` function has an optional single parameter that can be used to control the kind of web server we'll be using:

#### 1. Just give me a basic HTTP server

Without an argument, `createServer` will create a plain HTTP server to negotiate websocket "upgrade requests" (since all websocket connections start life as an HTTP call).

By default, that web server will not serve any sort of HTTP traffic outside of websocket upgrade calls, but you can assigned route handlers in order to serve regular content, using `.addroute(...)`:

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
  });
});
```

The `addRoute` function actually follows the Express.js middleware convention, so you can chain as many functions as you need, where any function can call `next()` to have the route handler move on to the next function:

```js
import { linkClasses} fom "socketless";
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
const server = factory.createServer()
server.listen(0, () => {
  console.log(`server is running on port ${server.address().port}`);

  // Add a route handler for the root:
  server.addRoute(`/`,
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

And should you ever need to remove a specific route handler, then `removeRoute(url)` will do that for you.

Now, this HTTP server can of course be presented to the outside world over HTTPS using an intermediary like [NGINX](https://www.nginx.com), but you could also...

#### 2. use HTTPS by providing your own certificate

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

And of course, let's be fair: you know how to run your own server, it's kind of silly to use a limited-functionality Node server based on the http/https packages, so you've probably written a million [express servers](https://expressjs.com) in your life and you'd `socketless` to just use that. So... let's do that:

#### 3. using an Express server

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

And of course again, you're almost certainly going to outsource HTTPS to NGINX or the like, but if you absolutely need to run your own express server over HTTPS, then we can do that too. [As per the Express docs](http://expressjs.com/en/5x/api.html#app.listen), we'll need to create our own HTTPS server again, so let's do that:

#### 4. Express on HTTPS

(To be fair, you wouldn't do this. But you can. And you'd do it like this)

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

In addition to this, _any function or instance property that you declare on the class will be RPC-accessible_ meaning that clients will be able to call those functions and have them run. As such, you don't want to declare "convenience" functions on your server class, and you'll want to declare those _outside_ the class instead. For example, you might be tempted to write the following code:

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

Because all instance properties are visible to clients, they can just bypass your API and directly work with things you'd really rather they didn't.

Instead, treat your server as purely an API layer between your "real" program, and your clients:

```js
// Our actual program
import { GameManager } from "src/game/game-manager.js";
const gameManager = new GameManager();
gameManager.init();

// Our server is just an RPC gateway into that program,
// exposing exactly *nothing* to clients:
class ServerClass {
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

Also note that any function that isn't the constructor has access to two special properties:

- `this.clients`, an array of clients, each a socket proxy of the connected client
- `this.quit()`, a method to close all connections and shut down the server.

And also note that any server function will be called with the client who called it as first argument. You don't need to wrap anything in object notation, but you will need to write your functions to take this into account, as clients will _not_ need to include themselves as a call argument:

```js
const ONE_WEEK_IN_MS = 1000 * 3600 * 24 * 7;

class ServerClass {
  async getGamesPlayed(client, startDate, endDate) {
    return gameManager.statistics.getGamesPlayed({
        id: client.id,
        range: [startDate, endDate]
    });
  }
}

class ClientClass {
  async onConnect() {
    const now = Date.now();
    const lastWeek = now - ONE_WEEK_IN_MS;
    const gameCount = await this.server.getGamesPlayed(lastWeek, now);
    ...
  }
}
```

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

Mirroring the server, clients have a special `this.server` that can be used to call server functions as if they were local calls in any function outside of the constructor.

## WebClients

Regular clients are self-contained, but if you want a client with a browser front-end, you're going to have to build a web client. Web clients are an extension on regular clients, and are created with the `createWebClient` function, yielding not just a client, but also that client's own web server for connecting a browser to:

```js
import url from "url";
const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

import { linkClasses } fom "socketless";
import { ClientClass, ServerClass} from "./my/classes.js";
const factory = linkClasses(ClientClass, ServerClass);

const serverURL = `http://...`;
const {client, clientWebServer } = createWebClient(serverUrl, `${__dirname}/public`);
clientWebServer.listen(0, () => {
  console.log(
    `client ready for browser connections on port ${clientWebServer.address().port}`
  );
})
```

As you can see, the `createWebClient` function doesn't just take the server URL, but also a string argument pointing at the directory that will host all the static assets such as your `index.html`, css files, images, etc.

### Defining a web-enabled client class

The web client class extends the client class with a few more events, and some extra pre-defined instance properties:

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

Any function except for the constructor has access to `this.browser`, a proxy of the browser. However, unlike the client and server proxies, calls made on `this.browser`` do _not_ time out, they remaining in a waiting state until the browser returns a value.

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

With a minimal `index.js` containing the `socketless` import and creation call for the browser portion of the web client:

```js
import { createBrowserClient} fom "./socketless.js";
import { BrowserClientClass } from "./ui.js";
createBrowserClient(BrowserClientClass);
```

Note that there are no extra steps you need to take to make sure that the `socketless.js` file exists in your assets directory: the client's web serer comes with special route handling for the `socketless.js` request.

## The browser

As mentioned, the browser can load `socketless` as a `./socketless.js` script relative to the web root, which exports a single function `createBrowserClient` with which to connect to the real client:

```js
import { createBrowserClient} fom "./socketless.js";
import { BrowserClientClass } from "./ui.js";
const instance = createBrowserClient(BrowserClientClass);
```

This builds an instance of the provided class, with a `this.server` property that lets the browser (think it) communicate(s) with the server (in reality it's getting proxied by the real client), as well as a `this.socket` that is the websocket connection to the real client. You should almost _never_ need to use it, but for the rare few times that you do, it's there.

Browser client classes may have an `init()` function, in which case that function will be called at the end of the `createBrowserClient` pass.

The browser is kept in sync with the client via the `this.state` variable, and browser client classes _should_ have an `update(prevState)` function, which gets called every time the state gets synced with the client. This is a one-way sync: the browser should be considered "a UI on top of the client's state", where the client is the _actual_ authority when it comes to what its state is. Do not write code that modifies `this.state` in the browser, treat it as a read-only variable, with the `update(prevState)` function being the signal that the state got updated, with the current state being `this.state` and the previous state being the `prevState` argument.

### How to "quit"

The `socketless` library explicitly does not come with a built in way to shut down the web client. Instead, the recommended way to achieve this is to use a URL that the browser can navigate to (or `fetch()`) and have that trigger a client shutdown:

```js
const serverUrl = `...`;
const { client, clientWebServer } = createWebClient(url, `${__dirname}/public`);

clientWebServer.addRoute(`/quit`, (req, res) => {
  client.quit();
  clientWebServer.close();
  res.write("client disconnected");
  res.end();
});

clientWebServer.listen(0, () => {
  const PORT = clientWebServer.address().port;
  const url = `http://localhost:${PORT}`;
  if (DEBUG) console.log(`web client running on ${url}`);
});
```

Your browser can then trigger this route using a page navigation to `/quit` or ``fetch(`/quit`)`` call. For added security, you probably also want to make sure only the connected browser is allowed to call this route, by dynamically generating the quit route in the client class as part of browser connection, and then remove it again during browser disconnects:

```js
class ClientClass {
  ...

  async onBrowserConnect(browser) {
    this.state.quitURL = `/${uuid.v4()}`
    this.webserver.addRoute(this.state.quitURL, (req, res) => {
      this.webserver.close();
      this.quit();
      res.write("Thank you, come again!");
      res.end();
    });
  }

  async onBrowserDisconnect(browser) {
    this.webserver.removeRoute(this.state.quitURL);
  }

  ...
}
```

And then because of the state syncing mechanism, your browser code will be able to use `this.state.quitURL` to call the correct URL that shuts the real client down.

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

#### React

You will need to mark `socketless.js` as an "external" library to make sure your bundler does not try to bake it into your app bundle. It _must_ be loaded at runtime in the browser.

```jsx
import ReactDOM from "react-dom";
import { useEffect, useState } from 'react';
import { UI } from "./components/ui";
import { createBrowserClient} fom "./socketless.js";

function App() {
  const [clientState, setClientState] = useState({});

  useEffect(() => {
    createBrowserClient(class {
      update() {
        setClientState(this.state);
      }
    });
  }, []);

  return <UI clientState={clientState} />
}

const root = ReactDOM.createRoot(document.body);
root.render(<App />);
```

And with that, our App will start up, and one-time create the browser client such that every time it receives an update, it calls `setClientState` with the new client state, which will update the App's `clientState` variable, which will in turn trigger a rerender in any downstream components we defined.

#### Vue

Make the app use a state variable, then create the browser client in `mounted()`, and have the update function update that state variable:

```js
import { createBrowserClient} fom "./socketless.js";

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

...I don't know Angular...

#### Svelte

...I don't know Svelte...

#### ???

...??????????
