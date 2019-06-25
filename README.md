# async-socket.io

This is a framework and methodology for using [socket.io](https://socket.io/) without writing any socket code yourself,
and came about from a need to write quite a lot of communication between clients and server,
which gets _really_ verbose, really fast, if you need to express all your calls as `socket.on`
and `socket.emit()` instructions, with pass-through handlers if you want your code to stay
relatively clean.

So instead, this framework lets you express the functions that your clients support, and the
functions your server supports, as a single namespaced API object such as:

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

Which you then run through the async-socket.io framework to auto-generate a set of proxy objects
that both take care of all the socket.io code, as well as hide the fact that sockets are even
used at all, allowing code to be written as if clients and the server have direct references
to each other:

```javascript
class Client {
    [...]

    async register(clientId) {
        this.id = clientId;
        this.users = await this.server.user.getUserList();
        return { status: `registered` };
    }

    [...]
}
```

You'll notice that `async` keyword, which is critically important: in order to allow
not just automatic socket handling, but also automatic data routing, all the functions
you promised would exist in the API must be declared as `async` functions, because this
lets the framework treat socket communication as promises, with automatica regitration
and deregistration of response events.

That's a technical detail, though; the important part is that using this framework, you
don't have to think about the fact that you're using sockets in any way, outside of making
sure to pass socket.io's `io` and `socket` values into the right functions.

## 1. Creating an API collection

As mentioned above, an API collection is created by defining a namespaced API object,
and then running that through the `generateClientServer` transformer:

```javascript
const generateClientServer = require('async-socket.io');

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

And then we use that `Server` class to implement our server:

```javascript
[...]

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

And then we make a(t least one) Client once the server is up:

```javascript
[...]

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

Have a look at the [demo](https://github.com/Pomax/async-socket.io/tree/master/demo) directory,
to see an example of a simple client/server setup with code in place that starts a server
and three clients, has the server inform each client what their `id` is when they connect,
adding them to a list of known users, and where each client invents a random name for themselves
upon registration, informeds the server of that name and then asks the server for the user list
that the server's maintaining, automatically getting notified of individual join/leave actions
when they occur.

You can run this demo using `npm test` in the `async-socket.io` directory.

This test can also be run using independent processes for the clients and server, by using
`npm test:distributed`, but this will spawn genuinely independent processes, and mostly exists
to show "things work" rather than offering you an easy way to examine what actually happens.
