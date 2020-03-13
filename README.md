# Socketless

Socketless is a websocket-based RPC-like minimal framework for client/server implementations, with web-wrappers for clients, requiring you to write exactly zero websocket code, and being able to call client or server functions on local objects, as if there was no network involved at all.

Socketless works by you writing your client and server as two main classes with a specific function naming scheme: any `async` function with a namespaced function name will be automatically picked up by Socketless when generating actual clients and servers.

Async namespaced functions takes the form of `async "namespace:fname"(...)` or `async namespace$fname(...)`.

With these two classes defined, you can generate client and server instances using the `generateClientServer` function that Socketless exports.

### Installation

Socketless can be installed using `npm`/`yarn`.

Note that because `socketless` is code that by definition needs to run server-side, it does not provide a precompiled single-file library in a `dist` directory, nor should it ever (need to) be part of a bundling task.

### Implementation and use example

A short example is the easiest way to demonstrate how Socketless works.

If we have the following client class:

```js
class ClientClass {
  constructor() {
    console.log("client> created");
  }

  onConnect() {
    console.log("client> connected to server");
    setTimeout(() => this.server.disconnect(), 3000);
    console.log("client> disconnecting in 3 seconds");
  }

  async "startup:register"() {
    this.name = `user${Date.now()}`;
    this.registered = await this.server.user.setName(this.name);
    console.log(`client> registered as ${this.name}: ${this.registered}`);
  }
}
```

And we have the following server class:

```js
class ServerClass {
  constructor() {
    console.log("server> created");
  }

  onConnect(client) {
    console.log(`server> new connection, ${this.clients.length} clients connected`);
    client.startup.register();
  }

  onDisconnect(client) {
    console.log(`server> client ${client.name} disconnected`);
    if (this.clients.length === 0) {
      console.log(`server> no clients connected, shutting down.`);
      this.quit();
    }
  }

  async "user:setName"(client, name) {
    console.log(`server> client is now known as ${name}`);
    client.name = name;
    return true;
  }
}
```

Then we can make things "just work" by bootstrapping Socketless with these two classes, using:

```js
const ClientClass = require(`./client.js`);
const ServerClass = require(`./server.js`);
const { generateClientServer } = require(`socketless`);
const factory = generateClientServer(ClientClass, ServerClass);

const server = factory.createServer();
server.listen(8000, () => {
    const client = factory.createClient("http://localhost:8000");
});
```

By running the above code, we should see the following output on the console:

```bash
server> created
client> created
server> new connection, 1 clients connected
client> connected to server
client> disconnecting in 3 seconds
server> client is now known as user1582572704133
client> registered as user1582572704133: true
server> client user1582572704133 disconnected
server> no clients connected, shutting down.
```

Note that this (especially) works when the client and server are not running on the same machine or even network. We could run the following code on a machine with a reverse proxy that maps a public host/port `1.2.3.4:80` to an internal `127.0.0.1:8000`:

```js
const ClientClass = require(`./client.js`);
const ServerClass = require(`./server.js`);
const { generateClientServer } = require(`socketless`);

const factory = generateClientServer(ClientClass, ServerClass);
factory.createServer().listen(8000, () => {
  console.log("Server listening on port 8000");
});
```

And this code running on a machine somewhere halfway across the world:

```js
const ClientClass = require(`./client.js`);
const ServerClass = require(`./server.js`);
const { generateClientServer } = require(`socketless`);

const factory = generateClientServer(ClientClass, ServerClass);
factory.createClient("http://1.2.3.4");
```

As long as there is agreement on the ClientClass and ServerClass, there's nothing else you need to do:

_Things just work._


# API documentation

Socketless exports a single function:

## generateClientServer

- `const factory = generateClientServer(ClientClass, ServerClass)`

This function yields a client/server factory when called, with the following public API:

- `factory.createServer([https:boolean])` creates a server instance that will either use `http` or `https` depending on the (optional) `https` argument. This defaults to false, yielding an `http` server. This server is used by clients as access address, and is used to negotiate a web socket connection.
- `factory.createClient(serverURL)` creates a client instance that connects to the server running at the specified full URL.
- `factory.createWebClient(serverURL, publicDir, options)` creates a client running its own http server that hosts a browser-loadable interface on its own address. The optional `options` object allows for a `useHttps` boolean, as well as a `directSync` boolean value. The first determines whether the client's own web server runs on http or https (defaulting to http), and the second determines whether the client's state is reflected to the browser via `this.state` or as direct properties on `this`. Setting this value to `true` is _not_ recommended.



## Server API

Server instances are created using `const server = factory.createServer(https?)`.

### Properties

- `clients`, an array of Client representations, allowing calls to client API functions as `[await] this.client.namespace.functionName(data)`.

### Methods

- `quit()`, closes all sockets and terminates the server.

### Special Client methods

- `client.disconnect()`, break the connection to a specific client.

### Event Handlers

- `onConnect(client)`, called when a client connects to the server
- `onDisconnect(client)`, called when a client initiated a disconnection
- `onQuit()`, called in response to `.quit()`, after closing all connections.


## Client API

Clients are created using `cosnt client = factory.createClient(serverURL)`

### Properties

- `server`, a Server representation, allowing calls to server API functions as `[await] this.server.namespace.functionName(data)`.

### Methods

### Special Server methods

- `server.broadcast(functionReference, data)`, initiates a broadcast to all clients for the specified function, with the included data. Note that the function reference is a true function reference. I.e. if a client class has `async "test:broadcast"(...) {...}` then a broadcast to all clients for this function can be effected by calling `this.server.broadcast(this["test:broadcast"], ...)`. This approach ensures that broadcasting can only work for real functions found in the client class.
- `server.disconnect()`, disconnect from the server

### Event Handlers

- `onConnect()`, called when the client has connected to the server
- `onDisconnect()`, called when the client gets disconnected by the server



## Webclient API

Web clients are an extension of the standard client with built-in functionality for exposing the client through a web interface by connecting a browser to the web client's own http(s) server.

Web clients are created with `const webclient = factory.createWebClient(serverURL, publicDir, options? = { useHttps?, directSync?})`

### Properties

The web client has the same API as the regular client, with three additional properties:

- `is_web_client`, a fixed value set to `true`
- `browser_connected`, `true` if a browser is connected to this client.
- `state`, an object used for internal state synchronization with a connected web interface. Any values that you want synced should be set on this object )note: there is not special `setState`, values can be set directly on this object).

Of these three `state` is technically not guaranteed, and depends on the `directSync` boolean passed as part of the creation call. When `true`, no state variable is used and the webclient itself is treated as the state object. _This is incredibly error prone, and is highly discouraged_ not to mention might be removed as functionality in the future, so don't rely on it.

### Methods

The web client has the same API as the regular client.

### Event handlers

The web client has the same API as the regular client, with two additional event handlers:

- `onBrowserConnect()`, called when a browser connects to this web client
- `onBrowserDisconnect()`, called when a connected browser disconnectrs from this web client


### Additional details

The `publicDir` will be used to serve this web client's HTML/CSS/JS interface when connected to by any web browser. In order for this to work, the `index.html` (or whatever custom name you decide on) **must** contain the following script code:

```html
<script src="socketless.js" async defer></script>
```

This will create a global `ClientServer` object that can be used to bootstrap a web interface for the client. See the next section for more details on this process.

Also, please note that this is _not_ the same `socketless.js` as gets loaded in Node context, and is a virtual file that is generated only when the web client's web server is asked to service the `./socketless.js` route. It is _not_ a file located on-disk and you should _absolutely not_ create a file called `socketless.js` in the web client's `publicDir`.


## Creating a client interface for the browser

Any standard JavaScript class that implements the API described below can be used as browser interface to a web client. (Note that the "web client" _runs_ a web server, and browsers _connect_ to the web client).

In order to register an interface class for use with a web client, your interface web page code should, after loading the web `socketless.js` library, use:

```js
const userInterface = ClientServer.generateClientServer(WebClientClass)
```

This will instantiate your client UI, and start the client syncing loop that ensures that your UI state is always a reflection of the current client's state.

Note that your UI is a pure view of the client's running state: while the UI has access to any client value, and is automatically kept in sync, that synchronization is one-way: you cannot _change_ values in the client state, only trigger functionality in the client that will lead to an updated state value. Once that happens, the browser syncing will automatically pick up on the new value.

### Autogenerated properties

These properties are added by `socketless` and can be accessed using `this.[propertyname]` in any function, except for the class constructor.

- `state`, the associated client's full state (unless `directSync` is used, which is _not_ recommended).
- `client`, a proxy into the client this browser client is connected to.
- `server`, a proxy for the server that the true client is connected to.

### Provided methods

- `sync()`, fetches the full client state (this should almost never be necessary), and does a full state replacement, throwing away anything in `this.staet` and rebinding it with the newly fetched data.
- `quit()`, instructs the associated client that we wish to disconnect from the server.

### Required methods

- `update(state)`, signal function to kick off "whatever needs to happen" with a reference to the state object for `this`less argument passing.

### Optional methods

- `setState(newstate)`, the current state of the server-side client. This function may be declared by you, or left implied, in which case `socketless` will create it for you.

In addition to the `setState` method, UI code can also implement any "real" method implemented in the client class, in which case whenever the client's function gets call, the web UI's copy will be called afterwards. This can be useful for dealing with signals from the server that don't necessarily lead to state updates, such as counting signals (e.g. 'you have until 5 seconds from now to decide on a move').

### Optional event Handlers

- `onConnect()`, called when the associated client connects to the server
- `onQuit()`, called when the associated client initiated a disconnect from the server
- `onDisconnect()`, called when the associated client gets diconnected from the server

### Example

A basic web UI class has the following form:

```js
import { RANDOM_NAMES } from "./random-names.js";

class WebUI {
  constructor() {
    ...
    setTimeout(() => this.setRandomName(), 500);
  }

  setRandomName() {
    let name = RANDOM_NAMES[this.state.id || 0];
    if (name) {
      this.server.user.setName(name);
    }
  }

  update(state) {
    // any time this triggers, we update our UI
    ...
    this.renderFooter(state);
    ...
  }

  renderFooter(state) {
    const quit = () => {
      this.server.quit();
    };

    return footer(p(
      `Disconnect from the server: `,
      button({ id: `quit`, "on-click": quit }, `quit`)
    ));
  }

  ...
}
```

<!--

## Socketless webclients and UI Framework interoperability

Socketless is ui-framework agnostic, and only cares the fact that you pass it a class with an `update(state)` function that it can instantiate. As such, for most UI frameworks the job of adding socketless is a matter of creating a minimal class that socketless can instantiate, and then having that expose its properties, as well as forward state updates, to your real UI code.

#### React

...

#### Vue.js

...

#### Angular

...

-->
