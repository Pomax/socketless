# Socketless

This is a framework and methodology for implementing a websocket client/server solution in which you write your code as normal, using namespaced function names, without ever having to think about how the network side of things is supposed to work. It'll simply work, and you can write code as if you're working on a socketless code base.

1. [Introduction](#introduction)
2. [Quick-start](#quick-start)
   - [Adding a browser-based client](#adding-a-browser-based-client)
3. [Conventions](#conventions)
4. [The `socketless` API](#the-socketless-api)
  - [Server]()
  - [Client]()
  - [Web Client]()
5. [Bugs, feature-requests, and discussions](#bugs-feature-requests-and-discussions)

## Introduction

This project was born out of a need to write quite a lot of communication between a game server and its clients, which gets _really_ verbose, really fast, if you need to express all your calls in terms of `socket.on` and `socket.emit()` instructions, especially if you're also writing pass-through handlers in order to keep your code to stay relatively clean and maintainable.

So, instead, this framework lets you specify a Client class, with namespaced functions (using either `async namespace$name()` or `async "namespace:name"()` format), and a Server class, with namespaced functions (using the same convention), as all the code you need to write:

```javascript
class ClientClass {
    async "admin:register"(clientId) {
        this.id = clientId;
        this.users = await this.server.user.getUserList();
    }
}

class ServerClass {
    async addClient(client) {
        client.id = getNextClientId();
        client.admin.register(client.id);
    }
    async "user:getUserList"() {
        return this.clients.map(...);
    }
}
```

You then pass these two classes to the `generateClientServer` transform that `socketless` provides, which generates a set of proxy objects that both take care of all the websocket code, as well as hides the fact that sockets are even used at all, allowing code to be written as if clients and the server have direct references to each other.

All _you_ need to do is stand up your clients and server with a few lines of code:

```javascript
const ClientClass = ...;
const ServerClass = ...;
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

Seriously: that's all we have to do.

We now have a fully functional websocket client/server setup, where both clients and server can talk to each other as if they had local references to each other's functions.

You might have noticed that both the Client and Server classes use the `async` keyword for their API functions: this is critically important. In order to allow not just automatic socket handling, but also automatic data routing over an inherently asynchronous network connection, all functions must be declared `async`. This lets the framework treat socket communication as promises, with automatic registration and deregistration of response events.

That's a technical detail, though; the important part is that you don't have to think about the fact that you're using sockets in any way using this framework. In fact, you don't even need to know which websocket technology is being used to make it all work:

**it just works.**

## Quick-start

Install this library using `npm` (or npm-compatible package manager) using:

```
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

For the purpose of this quick start, we'll use the `async "namespace:name"()` format:

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
2. You can set properties on clients. Normally this would be incredibly unsafe because it means you could overwrite API functions, but `socketless` binds those with write protection, so even if you did try to overwrite them, your code would throw a runtime exception.
3. all API handling functions in a server class are passed a reference to the client that made the API call as the `from` argument, universally passed as the first argument to any API call handling function:

If you have code in your Client class that calls `this.server.namespace.doThing(data)`, then your Server class should have a handling function with signature `async "namespace:doThing"(from, data) { ... }` (or `async namespace$doThing(from, data) { ... }` depending on your preferred style of namespacing).

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
        this.server.user.setName(name);
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

Also, you may notice that `broadcast` call, which points to the client's own `chat:message` function. This lets clients send a message "to everyone connected to the server" (including themselves). Also, rather than passing a string, which can have typos, or even be a functions that doesn't exist, you refer _directly_ to the function that needs to get called: all clients are built off of the same class, so we already know which function is supposed to be handling the data that's getting broadcast.

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

### 5. Read through an example

Have a look at the [demo](https://github.com/Pomax/socketless/tree/master/demo) directory, to see an example of a simple client/server setup with code in place that starts a server and three clients, has the server inform each client what their `id` is when they connect, adding them to a list of known users, and where each client invents a random name for themselves upon registration, informs the server of that name and then asks the server for the user list that the server's maintaining, automatically getting notified of individual join/leave actions when they occur.

You can run this demo using `npm test` in the `socketless` directory.

This test can also be run using independent processes for the clients and server, by using `npm test:distributed`, which runs separate node processes for the server and each client so you can verify that things don't work just because we build the server and clients in the same script. However, because this spawns genuinely independent processes, this test mostly exists to demonstrate that "things work", rather than offering you an easy way to examine what actually happens.

## Conventions

This is a mildly opinionated framework, and so there are a few conventions that apply both to the code you write and the way you structure calls.

### You know your API

The code relies on the fact that you know which functions exist, with client and server calls mapping to the corresponding functions in your client and server classes. However, the code can't automatically check that every call you're making doesn't have a typo, or points to a missing function, so rather than trying to parse your code to see whether there are any missing call handlers, `socketless` assumes you know which functions exist, and will throw a runtime error if you make any calls that don't have a corresponding handling function.

Also, if you're manually specifying your API interface (see section below), any call that you list in your `API` object that does not have a corresponding handler implemented (either namespaced or namespaceless) will throw a runtime error.

#### Bypassing the magic: manually specifying the functional interface

If you don't want to use namespacing, or you have functions in the client or server that are placeholders and not meant to be called "yet", you can manually specify the API interface that `generateClientServer` uses to build up all the internal code.

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
const API = ...
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
    async register(id) {
        this.id = id;
        this.server.broadcast(this.chatMessage, {
            id: id,
            msg: "hi"
        });
    }
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

### Structuring client/server calls

Both clients and servers can initiate calls to one another, which can be either "fire and forget" or "wait for a response", with the only distinction between the two being the use of `await`.

Irrespective of whether you will be using `await` in an API handling function, all handling functions **must** use the `async` keyword, as these calls map to network traffic, which is an inherently asynchronous affair.

#### Fire-and-forget

Fire-and-forget calls simply call the relevant API function and move on:

```javascript
class ClientClass {
    ...
    async triggerDoThing() {
        this.server.namespace.doThingPlease();
        console.log('done');
    }
    ...
}
```

This will send a trigger for the `doThingPlease` API handler function on the server and immediately move on to the next line of code, logging `done` to the console.

#### Calls that should return some data

If a call should return some data, such as asking a server for a user list, or needing a client to confirm receiving something, the call should be prefixed with `await`:

```javascript
class ClientClass {
    ...
    async triggerDoThing() {
        let result = await this.server.namespace.doThingPlease();
        console.log(result);
    }
    ...
}
```

This will send a trigger for the `doThingPlease` API handler function on the server and then wait for the server to send back whatever data it is expected to send back. As such, our next line of code will _not_ run until the server has responded with data that we can then immediately make use of. However, our code is not _stalled_ on this operation, and will continue to service other incoming calls in a way that, for practical purposes, can be treated as normal parallel processing.

### Structuring client/server code

In order to keep your code easy to maintain, it is recommended that you write your ClientClass and ServerClass classes as minimally as possible, with your real Client and Server classes extending these, so that your Client/Server classes primarily contain normal code, inheriting the actual API handling from their superclass. You don't _have_ to do this of course, but the whole reason this library exist is to keep code easy to maintain, so: keep your classes small and focused. It makes your life easier.

#### Server class specifics

Server classes receive a `this.getConnectedClients()` function for inspecting the list of connected clients.

Server classes _may_ implement the `onConnect(client)` function, which is called after a client has been connected to the server and recorded in the internal client list. This function does not need to be marked `async` as far as the framework is concerned, but of course if you're going to be writing anything that has an `await`, you'll need to mark it as `async` simply because you can't use `await` in a plain function.

Similarly, server classes _may_ implement the `onDisconnect(client)` function, which is called after a client has been disconnected from the server and removed from the internal client list. This function also does not need to be marked `async`.

The `client` argument passed to the `onConnect` and `onDisconnect` functions is a proxy instance that can be used to make remote calls by writing code that looks like local calls. In addition to the namespaced API functions it will have due to the code you wrote for clients, this `client` also has a `disconnect()` function to force it to disconnect from the server.

#### Client class specifics

Client classes are not passed a reference to the server they connected to. Instead, they can rely on the fact that `this.server` always resolves inside any class function. Note that this does _not_ include the constructor, as clients need to constructed before they can be connected to a server.

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

## The `socketless` API

The `socketless` library exports a single function called `generateClientServer` that acts as transformer for a Client/Server class pair:

```javascript
const ClientClass = ...
const ServerClass = ...
const { generateClientServer } = require('socketless');
const ClientServer = generateClientServer(API);
```

After which the `ClientServer` object can be used to bootstrap both clients and servers.

### • Clients classes

The `ClientClass` _may_ implement `onConnect()` and `onDisconnect()` to receive server connection and disconnection notifications, respectively.

Any function in the `ClientClass` (except the constructor) can use `this.server` to make API calls to the server. See the [Structuring client/server calls](#structuring-client-server-calls) section for more details.

Any function in the `ClientClass` (except the constructor) can use `this.server.broadcast(functionReference, data)`, which will get routed to every client connected to the server, _including the sender_. The `functionReference` is literally a reference to one of the client's own functions:

```javascript
class ClientClass {
    async someFunction() {
        this.server.broadcast(this.someOtherFunction, "test");
    }
    async someOtherFunction(stringData) {
        console.log(`triggered by broadcast: ${stringData}`);
    }
}
```

#### namespacing of call handler functions

Any API call handling function in a Client class **must** be namespaced, using either `$` as namespace separator:

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

### • Creating clients: `ClientServer.createClient(serverURL:urlstring)`

This function creates a socket client to the indicated URL, with all the bells and whistles taken care of. This function does not return a reference to the client, as clients are responsible for their own life cycle as implemented in their `ClientClass`.

### • Server classes

The `ServerClass` _may_ implement the `onConnect(client)` function.

The `ServerClass` _may_ implement the `onDisconnect(client)` function.

The `client` argument to these functions is a client proxy object with one extra function:

- `client.disconnect()`, which can be called to force a client to disconnect from the server


#### namespacing API call handler functions

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

### • Creating servers: `server = ClientServer.createServer([https:boolean])`

This function creates a web+socket server. If the `https` argument is set to `true`, this will create an HTTPS server, otherwise an HTTP server will be stood up. This function returns a reference to the server, which will either be a Node.js [Http.Server](https://nodejs.org/api/http.html#http_class_http_server) or a Node.js [Https.Server](https://nodejs.org/api/https.html#https_class_https_server), both of which inherit from the Node.js [net.Server](https://nodejs.org/api/net.html#net_class_net_server) class.

In order to start the server, use the standard Node.js server listen pattern (either using an explicit port, or 0 to automatically pick whichever open port is available):

```javascript
server.listen(0, () => {
    console.log(`Server running on port ${server.address().port}`);
});
```

### • Creating web clients: `ClientServer.createWebClient(ServerURL:urlstring, publicDir:pathstring)`

This function creates a client that pulls double duty as both a regular client and a web server that a user can connect to with their browser.

- WebClientClass, partial API

```html
<script src="socketless.js"></script>
```

```javascript
import ClientClass from "./client-class.js";
const { client, server } = ClientServer.generateClientServer(ClientClass);
```

## Bugs, feature-requests, and discussions

Please head on over to the [issue tracker](https://github.com/Pomax/socketless/issues) for the `socketless` library if you think you've found any bugs, have ideas that you would like to express as one or more feature requests, or have questions that you think need to be discussed regarding this library, the framework it offers, and the conventions it uses.

For more casual interaction, you can always [tweet](https://twitter.com/TheRealPomax) or [toot](https://mastodon.cloud/@TheRealPomax) at me.