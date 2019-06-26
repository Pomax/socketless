# Socketless

This is a framework and methodology for implementing a websocket client/server solution in which you specify the API and handler functions, without ever writing socket-related code, or even _seeing_ socket-related code.

1. [Introduction](#introduction)
2. [Quick-start](#quick-start)
3. [Conventions](#conventions)
4. [The `socketless` API](#the-socketless-api)
5. [Bugs, feature-requests, and discussions](#bugs-feature-requests-and-discussions)

## Introduction

This project was born out of a need to write quite a lot of communication between a game server and its clients, which gets _really_ verbose, really fast, if you need to express all your calls in terms of `socket.on` and `socket.emit()` instructions, especially if you're also writing pass-through handlers in order to keep your code to stay relatively clean and maintainable.

So, instead, this framework lets you express the functions that your clients support, and the functions your server supports, as a single namespaced API object such as:

```javascript
const API = {
    // the administrative namespace, for admin things.
    admin: {
        client: ['register', 'getStateDigest'],
        server: []
    },

    // the user namespace, for user related actions.
    user: {
        client: ['joined', 'left'],
        server: ['setName', 'getUserList']
    }
};
```

You then run this API through the `generateClientServer` transform that `socketless` provides, which generates a set of proxy objects that both take care of all the websocket code, as well as hide the fact that sockets are even used at all, allowing code to be written as if clients and the server have direct references to each other:

```javascript
class Client {
    ...

    async register(clientId) {
        this.id = clientId;
        this.users = await this.server.user.getUserList();
    }

    ...
}

class Server {
    ...

    async addClient(client) {
        this.clients.push(client);
        client.user.register(getNextClientId())
    }

    async getUserList() {
        return this.clients.map(...);
    }

    ...
}
```

You'll notice that `async` keyword, which is critically important: in order to allow not just automatic socket handling, but also automatic data routing, all the functions you promised would exist in the API must be declared as `async` functions, because this lets the framework treat socket communication as promises, with automatic registration and unregistration of response events.

That's a technical detail, though; the important part is that using this framework, you don't have to think about the fact that you're using sockets in any way. In fact, you don't even need to know which websocket technology is being used to make it all work:

**it just works.**

## Quick-start

Install this library using `npm` (or npm-compatible package manager) using:

```
npm install socketless --save
```

### 1. Creating an API collection

As mentioned above, an API collection is created by defining a namespaced API object, and then running that through the `generateClientServer` transformer that `socketless` provides:

```javascript
const { generateClientServer } = require('socketless');

const API = {
    user: {
        client: [ 'register', ...],
        server: [ 'setName', ... ]
    }
};

const ClientServer = generateClientServer(API);
```

### 2. Creating a Server

With the above code in place, you can create a Server class for actual API call handling, including an implementation for the mandatory `addClient(client)` function, and then create a websocket server with a single call.

First, our server class:

```javascript
...

class ServerClass {
    constructor() {
        this.clients = [];
    }

    addClient(client) {
        let clientId = this.clients.length;
        this.clients.push(client);
        client.user.register(clientId);
    }

    async setName(from, name) {
        let client = this.clients.find(c => c === from);
        client.name = name;
    }
}
```

Should you wish to explicitly namespace each handling function (e.g. to prevent call conflicts that might arise from having the same function name in two or more namespaces) you can do this in two ways: either by using the dollar symbol, `$`, as namespace separator:


```javascript
    async user$setName(from, name) {
        let client = this.clients.find(c => c === from);
        client.name = name;
    }
```

Or by using the colon, `:`, as namespace separator. However, note that `:` is not a legal character in function names, and so the full function name **must** be placed in quotes:

```javascript
    async "user:setName"(from, name) {
        let client = this.clients.find(c => c === from);
        client.name = name;
    }
```

With that taken care of, we use that `ServerClass` to instantiate our server:

```javascript
...

const server = ClientServer.createServer(ServerClass)
server.listen(0, () =>
    console.log(`started server on port ${server.address().port}`)
);
```

Note that all API handling functions in a server class are passed a reference to the client that made the API call as the `from` argument, universally passed as the first argument to any API call handling function.

If the client calls `server.doThing(data)`, the server should have a handling function with signature `async doThing(from, data) { ... }`.

### 3. Creating a Client

Creating a client is similar to creating a server:

```javascript
...

class ClientClass {
    constructor() {
        this.id = -1;
    }

    async register(clientId) {
        this.id = clientId;
        let name = this.name = generateRandomName();
        this.server.user.setName(name);
    }
}
```

(Again, explicit namespacing can be achieved using either `$`, or `:` with the function name in quotes).

And then we make one (or more) Client(s) once the server is up:

```javascript
...

server.listen(0, () => {
    const serverURL = `http://*:${server.address().port}`;
    ClientServer.createClient(serverURL, ClientClass);
});
```

API call handling functions for clients are not passed a `from`, as clients are connected to a single server. The origin of the call is always known, and the server proxy can always be referenced as `this.server` inside any API handling function.

### 4. Start talking to each other

Have a look at the [demo](https://github.com/Pomax/socketless/tree/master/demo) directory, to see an example of a simple client/server setup with code in place that starts a server and three clients, has the server inform each client what their `id` is when they connect, adding them to a list of known users, and where each client invents a random name for themselves upon registration, informeds the server of that name and then asks the server for the user list that the server's maintaining, automatically getting notified of individual join/leave actions when they occur.

You can run this demo using `npm test` in the `socketless` directory.

This test can also be run using independent processes for the clients and server, by using `npm test:distributed`, but this will spawn genuinely independent processes, and mostly exists to show "things work" rather than offering you an easy way to examine what actually happens.

## Conventions

This is a mildly opinionated framework, and so there are a few conventions that apply both to the code you write and the way you structure calls.

### Your API is a promise

The `API` object that you write, with namespaced lists of call names for clients and servers, is a promise about what your actual Client and Server classes will be implementing. You will recognize this pattern if you've ever worked in languages that use header files or interfaces.

Any call that you list in your `API` object but do not have an implementation for in your client or server class will generate a runtime error when invoked.

### Structuring client/server calls

Both clients and servers can initiate calls to one another, which can be either "fire and forget" or "wait for a response", with the only distinction between the two being the use of `await`.

Irrespective of whether you will be using `await` in an API handling function, all handling functions **must** use the `async` keyword, as these calls map to network traffic, which is an inherently asynchronous affair.

#### Fire-and-forget

Fire-and-forget calls simply call the relevant API function and move on:

```javascript
class ClientClass {
    ...
    async triggerDoThing() {
        server.namespace.doThingPlease();
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
        let result = await server.namespace.doThingPlease();
        console.log(result);
    }
    ...
}
```

This will send a trigger for the `doThingPlease` API handler function on the server and then wait for the server to send back whatever data it is expected to send back. As such, our next line of code will _not_ run until the server has responded with data that we can then immediately make use of. However, our code is not _stalled_ on this operation, and will continue to service other incoming calls in a way that, for practical purposes, can be treated as normal parallel processing.

### Structuring client/server code

In order to keep your code easy to maintain, it is recommended that you write your ClientClass and ServerClass classes as minimally as possible, with your real Client and Server classes extending these, so that your Client/Server classes primarily contain normal code, inheriting the actual API handling from their superclass. You don't _have_ to do this of course, but the whole reason this library exist is to keep code easy to maintain, so: keep your classes small and focussed. It makes your life easier.

#### Server specifics

Server classes must implement the `addClient(client)` function, which is called automatically when clients connect to the server. Any code that should run based on clients connecting should be either in, or called in, this function. This function does not need to be marked `async` as far as the framework is concerned, but of course if you're going to be writing anything that has an `await`, you'll need to mark it as `async` simply because you can't use `await` in a plain function.

The `client` argument passed to the `addClient(client)` function is the proxy instance that can be used to make remote calls by writing code that looks like local calls. In addition to the namespaced API functions it will have due to your own setup, this `client` also has an `.onDisconnect(fn)` function that can be called to "do something" when the client disconnects from the server, with `fn` being any function that should run.

You typically want to combine these two functions:

```javascript
class ServerClass{
    ...
    async addClient(client) {
      this.clients.push(client);
      client.onDisconnect(() => this.removeClient(client));
      ...
    }
    async removeClient(client) {
      let pos = this.clients.find(v => v===client);
      list.splice(pos, 1);
    }
    ...
```

The `client` argument passed to the `addClient(client)` function also has a `.disconnect()` function that can be called by the server to force a client to disconnect and clean up the socket connection between the two.

#### Client specifics

Client classes are not passed a reference to the server they connected to. Instead, they can rely on the fact that `this.server` always resolves inside any class function. Note that this does _not_ include the constructor, as clients need to constructed before they can be connected to a server.

Client classes may implement the `onConnect()` function, which is called when a client instance has connected to the server. This function does not take any arguments, and does not require the `async` keyword.

Client classes may implement the `onDisconnect()` function, which is called when the server explicitly disconnects the client, whether intentionally (e.g. because the client requested to be disconnected) or not (e.g. the server got shut down). This function also does not take any arguments, and also does not require the `async` keyword.

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

The `socketless` library exports a single function called `generateClientServer` that acts as transformer for namespaced API objects of the form:

```javascript
const API = {
    namespace: {
        client: ['APIfunctionName', ...],
        server: [...]
    },
    ...
}
```

This is then used to generate an actual `ClientServer` object as:

```javascript
const API = ...
const { generateClientServer } = require('socketless');
const ClientServer = generateClientServer(API);
```

After which the `ClientServer` object can be used to bootstrap both clients and servers.

### • Creating clients: `ClientServer.createClient`

This function has the following signature:

> **ClientServer.createClient(serverURL:urlstring, ClientClass:class)**


This function creates a socket client to the indicated URL, with all the bells and whistles taken care of. This function does not return a reference to the client, as clients are responsible for their own life cycle as implemented in their `ClientClass`.

The `ClientClass` _may_ implement `onConnect()` and `onDisconnect()` to receive server connection and disconnection notifications, respectively.

Any function in the `ClientClass` (except the constructor) can use `this.server` to make API calls to the server. See the [Structuring client/server calls](#structuring-client-server-calls) section for more details.


#### namespacing API call handler functions

Any API call handling function in the `ClientClass` may explicitly use the same namespacing as was indicated in the `API` object, either by using `$` as namespace separator:

```javascript
async namespace$name(...) {
    ...
}
```

or by using `:` as namespace separator, with the full function name in quotes:

```javascript
async "namespace:name"(...) {
    ...
}
```

### • Creating servers: `ClientServer.createServer`

This function has the following signature:

> **server = ClientServer.createServer(ServerClass:class [,https:boolean])**

This function creates a web+socket server. If the `https` argument is set to `true`, this will create an HTTPS server, otherwise an HTTP server will be stood up. This function returns a reference to the server, which will either be a Node.js [Http.Server](https://nodejs.org/api/http.html#http_class_http_server) or a Node.js [Https.Server](https://nodejs.org/api/https.html#https_class_https_server), both of which inherit from the Node.js [net.Server](https://nodejs.org/api/net.html#net_class_net_server) class.

In order to start the server, use the standard Node.js server listen pattern (either using an explicit port, or 0 to automatically pick whiever open port is available):

```javascript
server.listen(0, () => {
    console.log(`Server running on port ${server.address().port}`);
});
```

The `ServerClass` **must** implement the `addClient(client)` function.

The `client` argument to `addClient(client)` is an object with the following API:

- `.disconnect()`, which can be called to force a client to disconnect from the server
- `.onDisconnect(fn)`, which _may_ be called in order to bind a function that will run when the client disconnects from the server.

#### namespacing API call handler functions

Any API call handling function in the `ServerClass` may explicitly use the same namespacing as was indicated in the `API` object, either by using `$` as namespace separator:

```javascript
async namespace$name(...) {
    ...
}
```

or by using `:` as namespace separator, with the full function name in quotes:

```javascript
async "namespace:name"(...) {
    ...
}
```

## Bugs, feature-requests, and discussions

Please head on over to the [issue tracker]() for the `socketless` library if you think you've found any bugs, have ideas that you would like to express as one or more feature requests, or have questions that you think need to be discussed regarding this library, the framework it offers, and the conventions it uses.

For more casual interaction, you can always [tweet](https://twitter.com/TheRealPomax) or [toot](https://mastodon.cloud/web/accounts/112330) at me.