# Socketless

This is a framework and methodology for implementing a websocket client/server
solution in which you specify the API and handler functions, without every writing
socket-related code, or even _seeing_ socket-related code.

This project was born out of a need to write quite a lot of communication between
a game server and its clients, which gets _really_ verbose, really fast, if you need to
express all your calls in terms of `socket.on` and `socket.emit()` instructions, especially
if you're also writing pass-through handlers in order to keep your code to stay relatively
clean and maintainable.

So, instead, this framework lets you express the functions that your clients support, and
the functions your server supports, as a single namespaced API object such as:

```javascript
const API = {
    // the administrative namespace, for admin things.
    admin: {
        client: ['register', 'getStateDigest'],
        server: []
    },

    // the user namespace, for user related actions.
    user: {
        client: ['userJoined', 'userLeft'],
        server: ['setName', 'getUserList']
    }
};
```

You then run this API through the `socketless` transform, which generates a set of proxy objects
that both take care of all the websocket code, as well as hide the fact that sockets are even
used at all, allowing code to be written as if clients and the server have direct references
to each other:

```javascript
class Client {
    ...

    async register(clientId) {
        this.id = clientId;
        this.users = await this.server.user.getUserList();
        return { status: `registered` };
    }

    ...
}

class Server {
    ...

    async addClient(client) {
        this.clients.push(client);
        client.users.register(getNextClientId())
    }

    async getUserList() {
        return this.clients.map(...);
    }

    ...
}
```

You'll notice that `async` keyword, which is critically important: in order to allow
not just automatic socket handling, but also automatic data routing, all the functions
you promised would exist in the API must be declared as `async` functions, because this
lets the framework treat socket communication as promises, with automatic registration
and unregistration of response events.

That's a technical detail, though; the important part is that using this framework, you
don't have to think about the fact that you're using sockets in any way. In fact, you
don't even need to know which websocket technology is being used to make it all work:

**it just works.**

## 1. Creating an API collection

As mentioned above, an API collection is created by defining a namespaced API object,
and then running that through the `socketless` transformer:

```javascript
const generateClientServer = require('socketless');

const API = {
    user: {
        client: [ 'register', ...],
        server: [ 'setName', ... ]
    }
};

const ClientServer = generateClientServer(API);
```

## 2. Creating a Server

With the above code in place, you can create a Server class for actual API call handling,
including an implementation for the mandatory `addClient(client)` function, and then
create a websocket server with a single call:

```javascript
...

class ServerClass {
    constructor() {
        this.clients = [];
    }

    addClient(client) {
        this.clients.push(client);
        let clientId = this.clients.length;
        client.admin.register(clientId);
    }

    async setName(from, name) {
        let client = this.clients.find(c => c === from);
        client.name = name;
    }
}
```

And then we use that `ServerClass` to implement our server:

```javascript
...

const server = ClientServer.createServer(ServerClass)
server.listen(0, () =>
    console.log(`started server on port ${server.address().port})
);
```

Note that all API handling functions in a server class are passed
a reference to the client that made the API call as the `from`
argument, universally passed as the first argument to any API
call handling function.

If the client calls `server.doThing(data)`, the server should have
a handling function with signature `async doThing(from, data) { ... }`.

## 3. Creating a Client

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

And then we make one (or more) Client(s) once the server is up:

```javascript
...

server.listen(0, () => {
    const serverURL = `http://*:${server.address().port}`;
    ClientServer.createClient(serverURL, ClientClass);
});
```

API call handling functions for clients are not passed a `from`,
as clients are connected to a single server. The origin of the
call is always known, and the server proxy can always be referenced
as `this.server` inside any API handling function.

## 4. Start talking to each other

Have a look at the [demo](https://github.com/Pomax/socketless/tree/master/demo) directory,
to see an example of a simple client/server setup with code in place that starts a server
and three clients, has the server inform each client what their `id` is when they connect,
adding them to a list of known users, and where each client invents a random name for themselves
upon registration, informeds the server of that name and then asks the server for the user list
that the server's maintaining, automatically getting notified of individual join/leave actions
when they occur.

You can run this demo using `npm test` in the `socketless` directory.

This test can also be run using independent processes for the clients and server, by using
`npm test:distributed`, but this will spawn genuinely independent processes, and mostly exists
to show "things work" rather than offering you an easy way to examine what actually happens.
