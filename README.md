# Socketless

This is a framework and methodology for implementing a websocket client/server solution in which you write your code as normal, using namespaced function names, without ever having to think about how the network side of things is supposed to work. It'll simply work, and you can write code as if you're working on a socketless code base.

  * [Introduction](#introduction)
  * [Quick-start](#quick-start)
    + [1. Set up the minimal code](#1-set-up-the-minimal-code)
    + [2. Create a Server class](#2-create-a-server-class)
    + [3. Create a Client class](#3-create-a-client-class)
    + [4. Start talking to each other](#4-start-talking-to-each-other)
    + [5. Read through a real example](#5-read-through-a-real-example)
      - [A simple example: `npm test`](#a-simple-example---npm-test-)
      - [A distributed simple example: `npm run test:distributed`](#a-distributed-simple-example---npm-run-test-distributed-)
      - [Multiplayer mahjong: `npm run game`.](#multiplayer-mahjong---npm-run-game-)
- [Conventions](#conventions)
  * [You know your API](#you-know-your-api)
    + [Bypassing the magic: manually specifying your client/server interface](#bypassing-the-magic--manually-specifying-your-client-server-interface)
  * [Structuring client/server calls](#structuring-client-server-calls)
    + [Fire-and-forget](#fire-and-forget)
    + [Calls that should return some data](#calls-that-should-return-some-data)
  * [Structuring client/server code](#structuring-client-server-code)
    + [Server class specifics](#server-class-specifics)
    + [Client class specifics](#client-class-specifics)
- [The `socketless` API](#the--socketless--api)
  * [Server classes](#server-classes)
    + [Namespacing API call handler functions](#namespacing-api-call-handler-functions)
    + [Creating servers: `server = ClientServer.createServer([https:boolean])`](#creating-servers---server---clientservercreateserver--https-boolean---)
  * [Clients classes](#clients-classes)
    + [Namespacing of call handler functions](#namespacing-of-call-handler-functions)
    + [Creating clients: `ClientServer.createClient(serverURL:urlstring)`](#creating-clients---clientservercreateclient-serverurl-urlstring--)
  * [Web clients](#web-clients)
    + [Creating web clients: `ClientServer.createWebClient(ServerURL:urlstring, publicDir:pathstring)`](#creating-web-clients---clientservercreatewebclient-serverurl-urlstring--publicdir-pathstring--)
    + [Browser client code](#browser-client-code)
    + [The server-side client class](#the-server-side-client-class)
    + [The browser-side client class](#the-browser-side-client-class)
    + [Direct synchronisation](#direct-synchronisation)
- [Bugs, feature-requests, and discussions](#bugs--feature-requests--and-discussions)

## Introduction

This project was born out of a need to write quite a lot of communication between a game server and its clients, which gets _really_ verbose, really fast, if you need to express all your calls in terms of `socket.on` and `socket.emit()` instructions, especially if you're also writing pass-through handlers in order to keep your code to stay relatively clean and maintainable.

So, instead, this framework lets you specify a Client class, with namespaced functions (using either `async namespace$name()` or `async "namespace:name"()` format), and a Server class, with namespaced functions (using the same convention), as all the code you need to write:

```javascript
class ClientClass {
    async "admin:register"(clientId) {
        this.id = clientId;
        this.userlist = await this.server.user.getUserList();
    }
}

class ServerClass {
    constructor() {
        this.users = [];
    }

    async onConnect(client) {
        user = { client, id: uuid() };
        this.users.push(user);
        client.admin.register(user.id);
    }

    async "user:getUserList"() {
        return this.users.map(...);
    }
}
```

You then pass these two classes to the `generateClientServer` transform that `socketless` provides, which generates a set of proxy objects that both take care of all the websocket code, as well as hides the fact that sockets are even used at all, allowing code to be written as if clients and the server have direct references to each other.

All _you_ need to do is stand up your clients and server with a few lines of code:

```javascript
const { ClientClass, ServerClass } = require('client-and-server-class.js')
const { generateClientServer } = require('socketless');
const ClientServer = generateClientServer(ClientClass, ServerClass);

// stand up a server:
const server = ClientServer.createServer();

// fire up the server and connect three clients:
server.listen(8080, () => {
    const clients = [
        ClientServer.createClient(`http://localhost:8080`),
        ClientServer.createClient(`http://localhost:8080`),
        ClientServer.createClient(`http://localhost:8080`),
    ];
});
```

And that's it, we're done.

Seriously: **that's all we have to do**; We now have a fully functional websocket client/server setup, where both clients and server can talk to each other as if they had local references to each other's functions.

You might have noticed that both the Client and Server classes use the `async` keyword for their API functions: this is critically important. In order to allow not just automatic socket handling, but also automatic data routing over an inherently asynchronous network connection, all functions must be declared `async`. This lets the framework treat socket communication as promises, with automatic registration and deregistration of response events.

That's a technical detail, though; the important part is that you don't have to think about the fact that you're using sockets in any way using this framework. In fact, you don't even need to know which websocket technology is being used to make it all work:

**it just works.**

## Quick-start

Install this library using `npm` (or npm-compatible package manager like `yarn`) using:

```bash
npm install socketless
```

Or if you're using this in a project that uses `package.json` dependency tracking:

```bash
npm install socketless --save
```


### 1. Set up the minimal code

We start with this library's boilerplate code:

```javascript
const { generateClientServer } = require('socketless');
const ClientServer = generateClientServer(ClientClass, ServerClass);
```

### 2. Create a Server class

Create a Server class with namespaced functions for everything you want the server to be able to do. This class may implement two special functions for custom logic when clients connect and disconnect, using the `onConnect(client)` and `onDisconnect(client)` signatures.

For namespacing you have two choices: you can either use `async namespace$name()`, or `async "namespace:name"()`, the first uses the legal-in-names character `$`, but may look quite ugly to many developers, the second uses the illegal-in-names character `:` and so requires the full function name to be written in quotes. Pick whichever you like best.

For the purpose of this README, we'll use the `async "namespace:name"()` format:

```javascript
class ServerClass {
    onConnect(client) {
        client.id = this.clients.length;
        client.admin.register(client.id);
    }

    async "user:setName"(from, name) {
        let client = this.clients.find(c => c === from);
        client.name = name;
    }
}
```

You might notice a few things:

1. There is a `this.clients` that is (unsurprisingly) the list of all clients connected to this server. This list is maintained for you by `socketless`.
2. You can set properties on clients. Normally this is incredibly unsafe because you could overwrite API functions and properties, but `socketless` binds any of its own properties and functions with write protection, so even if you did try to overwrite them, your can't: your code will throw an error.
3. all API functions that a client can call are automatically passed a `from` argument, representing that client: if you have code in your Client class that calls `this.server.namespace.doThing(data)`, then your Server class should have a handling function with signature `async "namespace:doThing"(from, data) { ... }` (or `namespace$doThing(from, data)`, depending on your preferred style of namespacing).

### 3. Create a Client class

Creating a client is similar to creating a server:

```javascript
class ClientClass {
    constructor() {
        this.id = -1;
    }

    async "admin:register"(id) {
        this.id = id;
        let name = this.name = generateRandomName();
        await this.server.user.setName(name);
        this.server.broadcast(this["chat:message"], {
            name: name,
            message: "hello!"
        });
    }

    async "chat:message"(name, message) {
        if (name !== this.name) {
            console.log(`${name}> ${message}`);
        }
    }
}
```

Note that API call handling functions for clients are not passed a `from`, as clients are connected to a single server. The origin of the call is always known, and the server proxy can always be referenced as `this.server` inside any API handling function that the client makes use of.

Also, you may notice that `server.broadcast` call, which points to the client's own `chat:message` function. This lets clients send a message "to everyone connected to the server" (including themselves). And rather than passing a string, which can have typos or even be a functions that doesn't exist, you refer _directly_ to the function that needs to get called: all clients are built off of the same class, so we already know that function will exist for all receivers.

### 4. Start talking to each other

We can then our classes and boilerplate code, start a server, and connect some clients:

```javascript
const ClientClass = require('./client-class.js');
const ServerClass = require('./server-class.js');
const { generateClientServer } = require('socketless');
const ClientServer = generateClientServer(ClientClass, ServerClass);

// create a server:
const server = ClientServer.createServer();

// fire up the server and connect three clients:
server.listen(8080, () => {
    const clients = [
        ClientServer.createClient(`http://localhost:8080`),
        ClientServer.createClient(`http://localhost:8080`),
        ClientServer.createClient(`http://localhost:8080`),
    ];
});
```

### 5. Read through a real example

Have a look at the [demo directory](https://github.com/Pomax/socketless/tree/master/socketless-demo), which houses several demos that you can run to see the `socketless` library in action.

The most interesting of these is the [multiplayer game demo](https://github.com/Pomax/socketless/tree/master/socketless-demo/game) which implements (most of) the game of mahjong, which is a four player, draw-one-play-one style game.

# Conventions

This is an opinionated framework, and so there are a few conventions that apply both to the code you write and the way you structure calls.

## You know your API

The code relies on the fact that you know what you want to do, and how to express that as client/server function pair. While it is able to do a lot to make client/server implementations easier, `socketless` does not do static code analysis, and so can't tell whether a function you're calling on the client, or on the server, actually exists until runtime, and will throw a runtime error if you make any calls that don't have a corresponding handling function (either due to typoes or because you forgot to implement them before running the code).

Also, if you're manually specifying your API interface (see the section on this, below), any call that you list in your `API` object that does not have a corresponding handler implemented (either namespaced or namespaceless) will throw a runtime error.

### Bypassing the magic: manually specifying your client/server interface

If you don't want to use namespacing, or you have functions in the client or server that are placeholders and not meant to be called "yet", or you just want strict control over your API surface, you can manually specify the API interface that `generateClientServer` uses to build up all the internal code.

To do this, create an object of the form:

```javascript
const API = {
    namespace1: {
        client: ['functionname1', 'functionname2', ...],
        server: [...]
    },
    namespace2: {
        ...
    },
    ...
};
```

And then call `generateClientServer` with this API as third argument:

```javascript
const ClientClass = require('./client-class.js');
const ServerClass = require('./server-class.js');
const API = require('./manually-specified-api.js');
const { generateClientServer } = require('socketless');
const ClientServer = generateClientServer(ClientClass, ServerClass, API);
```

When using this approach, call handlers do not _need_ to be namespaced (although you'll run into naming conflicts if you declare the same handling function name for different namespaces):

```javascript
const API = {
    admin: {
        client: ["register"],
        server: []
    },
    chat: {
        client: ["chatMessage"],
        server: []
    }
}

class ClientClass {
    // note the lack of namespacing:
    async register(id) {
        this.id = id;
        this.server.broadcast(this.chatMessage, {
            id: id,
            msg: "hi"
        });
    }
    // note the lack of namespacing, again:
    async chatMessage({ id, msg }) {
      ...
    }
}

let clientId = 0;

class ServerClass {
    onConnect(client) {
        client.admin.register(clientId++);
    }
}

const { generateClientServer } = require('socketless');
const ClientServer = generateClientServer(ClientClass, ServerClass, API);
```

## Structuring client/server calls

Both clients and servers can initiate calls to one another, which can be either "fire and forget" or "wait for a response", with the only distinction between the two being the use of `await`.

Irrespective of whether you will be using `await` in an API handling function, all handling functions **must** use the `async` keyword, as these calls map to network traffic, which is an inherently asynchronous affair. Forgetting to mark them as `async` will cause a runtime error informing you that you forget this crucial keyword.

### Fire-and-forget

Fire-and-forget calls simply call the relevant API function and move on:

```javascript
class ClientClass {
    ...
    async triggerDoThing() {
        this.server.namespace.doThingPlease();
        console.log(`we don't care if that succeeded or not`);
    }
    ...
}
```

This will send a trigger for the `doThingPlease` API handler function on the server and immediately move on to the next line of code, logging `done` to the console.

### Calls that should return some data

If a call should return some data, such as asking a server for a user list, or needing a client to confirm receiving something, the call should be prefixed with `await`:

```javascript
class ClientClass {
    ...
    async triggerDoThing() {
        let result = await this.server.namespace.doThingPlease();
        console.log(`this won't trigger until we have a:`, result);
    }
    ...
}
```

This will send a trigger for the `doThingPlease` API handler function on the server and then wait for the server to send back whatever data it is expected to send back. As such, our next line of code will _not_ run until the server has responded with data that we can then immediately make use of. However, our code is not _stalled_ on this operation, and will continue to service other incoming calls in a way that, for practical purposes, can be treated as normal parallel processing.

## Structuring client/server code

In order to keep your code easy to maintain, it is recommended that you write your ClientClass and ServerClass classes as minimally as possible, with your real Client and Server code extending these, so that your real client and server primarily contain normal code, inheriting the actual API handling from their superclass. You don't _have_ to do this of course, but the whole reason this library exist is to keep code easy to maintain, so: keep your classes small and focused. It makes your life easier.

### Server class specifics

Server classes receive a `this.getConnectedClients()` function for inspecting the list of connected clients. This function returns an array of client proxy objects.

Server classes _may_ implement the `onConnect(client)` function, which is called after a client has been connected to the server and recorded in the internal client list. This function does not need to be marked `async` as far as the framework is concerned, but of course if you're going to be writing anything that has an `await`, you'll need to mark it as `async` simply because you can't use `await` in a plain function.

Similarly, server classes _may_ implement the `onDisconnect(client)` function, which is called after a client has been disconnected from the server and removed from the internal client list. This function also does not need to be marked `async`.

The `client` argument passed to the `onConnect` and `onDisconnect` functions is a proxy instance that can be used to make remote calls by writing code that looks like local calls. In addition to the namespaced API functions it will have due to the code you wrote for clients, this `client` also has a `disconnect()` function to force it to disconnect from the server.

### Client class specifics

Client classes are not passed a reference to the server they connected to in their constructor or any of their function calls. Instead, they can rely on the fact that `this.server` always resolves inside any class function. Note that this does _not_ include the constructor, as clients need to constructed before they can be connected to a server.

Client classes *may* implement the `onConnect()` function, which is called when a client instance has connected to the server. This function does not take any arguments, and does not require the `async` keyword.

Client classes *may* implement the `onDisconnect()` function, which is called when the server explicitly disconnects the client, whether intentionally (e.g. because the client requested to be disconnected) or not (e.g. the server got shut down). This function also does not take any arguments, and also does not require the `async` keyword.

```javascript
class Client {
    ...
    onConnect() {
        console.log(`client> connected to server.`);
    }
    onDisconnect() {
        console.log(`client> was disconnected from server.`);
    }
    ...
}
```

### Webclient class specifics

Webclient classes are treated as extensions of regular Client classes, with the following additionals:

Webclient code has access a read-only `this.is_web_client` property that is set to `true`. This can be used to write classes that act as autonomous clients when created using `ClientServer.createClient()`, and act as browser controlled proxies when created using `ClientServer.createWebclient()`.

Webclient code has access to a read-only `this.browser_connected` property is set to `true` when a browser connection has been established.

Webclient classes *may* implement the `onQuit()` function, which is called when the browser UI explicitly quits from the server, intentionally causing a server disconnect.This function does not take any arguments, and does not require the `async` keyword.

Webclient classes, by default (although this can be changed, see below) use a `this.state` object to represent "all the data that should be accessible in the browser". This object may be directly manipulated, or may be manipulated through `this.setState({ ...})`, which will bulk-update the state variable. Any changes made to the state as a result of API function calls will automatically get reflected in the browser. If you need to update the state out-of-band, "you're doing it wrong". You should not have any reason to ever need to do so.

#### Bypassing `this.state`

Webclients can be created such that rather than using `this.state` as the source of truth for their browser interface, the client object itself is the source of truth for their browser interface. This is not advisable, but _can_ be done by passing `{ directSync: true }` as third argument for the `ClientServer.createWebclient()` function.

#### Browser interfaces

Browsers connected to webclients should load `socketless.js` as script in their HTML code (which is autogenerated by the webclient's web server), and implement the software equivalent of a [thin client](https://en.wikipedia.org/wiki/Thin_client): the `socketless.js` script creates a `ClientServer` object browser-side with a single function `ClientServer.generateClientServer(UIClass)` that ingests a JavaScript class of the form:

```javascript
class UIClass {
  // Any state value that in the true client is found in `this.state`
  // can be access as local variable in this class. For example, if
  // the client has a this.state.opCount property with value 10, then
  // this class can access that value as this.opCount directly.

  update(updatedState) {
    // Called any time the true client updates their state.
    // Effect UI updates through this call, based on all synced properties.
  }
}
```

Calling this functions yields both an object `{ client, server }`, and builds a UIClass instance that will have its `.update(updatedState)` function called any time the true client and the browser are synchronised, with `updatedState` reflecting the latest known state.

As for regular Clients, the browser UI is built with several functions and properties presupplied: `this.server` is, for all intents and purposes, the same as `this.server` in the client; `this.state` is equally the same thing, unless `directSync:true` was used to construct the web client. There is also a `this.sync()` function that the browser can use to force a full state synchronisation with the client, and there is a `this.server.quit()` that can be called by the browser to effect a client-disconnect.

# The `socketless` API

The `socketless` library exports a single function called `generateClientServer` that acts as transformer for a Client/Server class pair:

```javascript
const ClientClass = ...
const ServerClass = ...
const { generateClientServer } = require('socketless');
const ClientServer = generateClientServer(ClientClass, ServerClass);
```

After which the `ClientServer` object can be used to bootstrap both clients and servers.

This function can be called with an explicit API surface object as third argument:

```javascript
const ClientClass = ...
const ServerClass = ...
const API = ...
const { generateClientServer } = require('socketless');
const ClientServer = generateClientServer(ClientClass, ServerClass, API);
```

## Server classes

The `ServerClass` _may_ implement the `onConnect(client)` function.

The `ServerClass` _may_ implement the `onDisconnect(client)` function.

The `client` argument to these functions is a client proxy object with one extra function:

- `client.disconnect()`, which can be called to force a client to disconnect from the server


### Namespacing API call handler functions

Any API call handling function in a Server class **must** be namespaced, using either `$` as namespace separator:

```javascript
async namespace$name(...) {
    ...
}
```

or using `:` as namespace separator, with the full function name in quotes:

```javascript
async "namespace:name"(...) {
    ...
}
```

### Creating servers: `server = ClientServer.createServer([https:boolean])`

This function creates a web+socket server. If the `https` argument is set to `true`, this will create an HTTPS server, otherwise an HTTP server will be stood up. This function returns a reference to the server, which will either be a Node.js [Http.Server](https://nodejs.org/api/http.html#http_class_http_server) or a Node.js [Https.Server](https://nodejs.org/api/https.html#https_class_https_server), both of which inherit from the Node.js [net.Server](https://nodejs.org/api/net.html#net_class_net_server) class.

In order to start the server, use the standard Node.js server listen pattern (either using an explicit port, or 0 to automatically pick whichever open port is available):

```javascript
server.listen(0, () => {
    console.log(`Server running on port ${server.address().port}`);
});
```

## Clients classes

The `ClientClass` _may_ implement `onConnect()` and `onDisconnect()` to receive server connection and disconnection notifications, respectively.

Any function in the `ClientClass` (except the constructor) can use `this.server` to make API calls to the server. See the [Structuring client/server calls](#structuring-client-server-calls) section for more details.

Any function in the `ClientClass` (except the constructor) can use `this.server.broadcast(functionReference, data)`, which will get routed to every client connected to the server, including the sender. The `functionReference` is literally a reference to one of the client's own functions:

```javascript
class ClientClass {
    async someFunction() {
        // broadcast to all clients, specifically to their "someOtherFunction" function:
        this.server.broadcast(this.someOtherFunction, "test");
    }

    async someOtherFunction(stringData) {
        console.log(`triggered by broadcast: ${stringData}`);
    }
}
```

### Namespacing of call handler functions

Any call handling function in a Client class **must** be namespaced, using either `$` as namespace separator:

```javascript
async namespace$name(...) {
    ...
}
```

or using `:` as namespace separator, with the full function name in quotes:

```javascript
async "namespace:name"(...) {
    ...
}
```

### Creating clients: `ClientServer.createClient(serverURL:urlstring)`

This function creates a socket client to the indicated URL, with all the bells and whistles taken care of. This function does not return a reference to the client, as clients are responsible for their own life cycle as implemented in their `ClientClass`.

## Web clients

In addition to regular clients, `socketless` allows for the creation of "Web clients", which are clients that act as intermediary between the server and a browser: the same principles apply, with the addition of state management to fascilitate automatic synchronisation of the client and the connected browser.

### Creating web clients: `ClientServer.createWebClient(ServerURL:urlstring, publicDir:pathstring)`

This function replaces the `createClient` call, and takes an extra argument in the form of a "public" directory that must house (at least) an index.html file that can be loaded by a browser:

```javascript
const ClientClass = ...
const ServerClass = ...
const { generateClientServer } = require('socketless');
const ClientServer = generateClientServer(ClientClass, ServerClass);

const serverURL = `http://some.domain.skt`;
const publicDir = `${__dirname}/public`;
const webclient = ClientServer.createWebClient(url, publicDir);
```

In order for a browser to connect via this client, its web server needs to be started manually, similar to how a server instance needs to be started, either on an explicit port, or port 0 to pick "a random free port":

```javascript
webclient.listen(0, () => {
  console.log(`web client listening on port ${webclient.address().port}`);
});

```
### Browser client code

The `index.html` file in the web client's public directory needs to load the `socketless` client library, which is autogenerated from the `/socketless.js` route. Once loaded, a global `ClientServer` object will be available for generating the client and server proxies for use in the browser:

```html
<!doctype html>
  ...
  <script src="socketless.js" async></script>
  <script defer>
    class WebClientClass {
      ...
    }
    const { client, server } = ClientServer.generateClientServer(WebClientClass);
  </script>
</html>
```

### The server-side client class

In order to work with the browser, the server-side client class has additional functions available:

- `this.state`, an object that the browser code will synchronise on. This object may be directly modified.
- `this.setState()`, a function for bulk-setting multiple state values simultaneously.

The client _may_ implement the following function:

- `onQuit()`, this function is called automatically when the browser-side code calls `this.server.quit()`

### The browser-side client class

The browser-side client class is a thin client that is kept in sync with the server-side client's `state` object. As such, the browser-side client is never a source of authority, all true state is maintained by the real client. The only function the browser-side client needs to implement is:

- `update(updatedState)`, called automatically any time the real client's state has changed (typically in response to an API function call), `updatedState` reflecting the latest known clietn state.

The browser-side client _may_ additionally implement any of the API functions, with namespacing, in which case `socketless` will trigger those functions in the browser _after_ resolving those functions in the real client. Use this as signals, not as UI updates.

The browswer-side client has access to `this.server`, which is the proxy object representing the server.

There is no local proxy for the real client: all state is synchronised automatically through `this.state`, which is a reflection of the real client's state. If the web client was built using `directSync` (see below), the browser-side client is the direct reflection of the real client without a `state` property. Needless to say, this is not advisable.

Should the browser-side client need to trigger a synchronisation outside of the normal update mechanism, `this.sync()` may be called to effect a full state resynchronisation ending in `update(updatedState)` getting run.

In order to signal a shutdown of the client, browser-side clients may call `this.server.quit()`, which is a special function that effects a server disconnect followed by a `client.onQuit()` call (provided the client has `onQuit()` implemented). Note that this means that just closing the browser will _not_ cause the client to disconnect from the server.

### Direct synchronisation

While using `this.state` means it is impossible to pollute the browser-side client with any "private" properties used by the real client, the use of `this.state` can be bypassed by passing `{ directSync: true}` into the `createWebClient` call as third argument:

```javascript
const webclient = ClientServer.createWebClient(url, publicDir, { directSync: true });
```

This will cause `socketless` to treat the client itself as state object, and will synchronise to the browser-side client based on its properties rather than using a separate `state` property.

# Bugs, feature-requests, and discussions

Please head on over to the [issue tracker](https://github.com/Pomax/socketless/issues) for the `socketless` library if you think you've found any bugs, have ideas that you would like to express as one or more feature requests, or have questions that you think need to be discussed regarding this library, the framework it offers, and the conventions it uses.

For more casual interaction, you can always [tweet](https://twitter.com/TheRealPomax) or [toot](https://mastodon.cloud/@TheRealPomax) at me.