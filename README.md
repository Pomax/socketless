# async-socket.io

This is a framework and methodology for using socket.io without writing any socket code yourself,
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
        client: [
            'register',
            'getStateDigest'
        ],
        server: []
    },
    
    // the user namespace, for user related actions.
    user: {
        client: [
            'userJoined',
            'userLeft',
        ],
        server: [
            'setName',
            'getUserList'
        ]
    }
};
```

Which you then use to generate proxy objects that both take care of all the socket.io code,
as well as hide the fact that sockets are even used at all, allowing code to be written as
if clients and the server have direct references to each other:

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
and then running that through the `buildAsyncFunctions` transformer:

```javascript
const buildAsyncFunctions = require('async-socket.io');
const API = {
    user: {
        client: [ 'register' ],
        server: [ 'setName' ]
    }
};
const ClientServer = buildAsyncFunctions(API);
```

## 2. Creating a Server

With the above code in place, you can create a socket.io server however you like
(using node's `http`, or Express.js, or whatever else socket.io supports), and
then use the resulting socket.io server and the `ClientServer` object created
above to make your life a lot easier:

```javascript
class Server {
    constructor(io, ServerAPI) {
        ServerAPI.setupHandlers(this, io, socket => {
            let client = ServerAPI.createClient(socket);
            client.onDisconnect(() => console.log(`server> client disconnected`));
            // do something with client!
        })
    }

    // our API definition said the server had a `setName`, so: make sure it exists!
    async setName(clientId, name) {
      // ...
    }
}
```

And then we use that `Server` class to implement our server:

```javascript
[...]

const webserver = require("http").Server();
const io = require("socket.io")(webserver);
const Server = require('./server');
new Server(io, ClientServer.server);
webserver.listen(0, () =>
    console.log(`started server on port ${server.address().port})
);
```

## 3. Creating a Client

Creating a client is similar to creating a server:

```javascript
class Client {
    constructor(socket, ClientAPI) {
        let server = this.server = ClientAPI.createServer(socket, this);
        server.onDisconnect(() => console.log(`client> disconnected from server.`))
    }

    // our API definition said the client had a `register`, so: make sure it exists!
    async register(clientId) {
      this.id = clientId;
    }
}
```

And then we make a(t least one) Client once the server is up:

```javascript
[...]
const Client = require('./client');
webserver.listen(0, () => {
    const serverURL = `http://*:${webserver.address().port}`;
    const socketToServer = require(`socket.io-client`)(serverURL);
    new Client(socketToServer, ClientServer.client);
});
```

## 4. Start talking to each other

We can now start taking advantage of the "it looks like normal code" part, where we can call
functions from the client "on" the server, and vice versa, and can even await the result of
those calls. For example, we can give the server the following code:

```javascript
class Server {
    constructor(io, ServerAPI) {
        this.clients = [];
        ServerAPI.setupHandlers(this, io, socket => {
            let client = ServerAPI.createClient(socket);
            client.onDisconnect(() => console.log(`server> client disconnected`));
            this.addClient(client, socket);
        })
    }
    
    async addClient(client,socket) {
        const clientId = uuid();
        const clientObj = { client, socket, clientId };
        const others = this.clients.slice();
        this.clients.push(clientObj);
        clientObj.confirmation = await client.admin.register(clientId);
        others.forEach(clientObj => clientObj.client.user.joined(clientId));
    }
}
```

Here, the server will client a local client represenation when a client connects,
and will then tell the client it has been registered with a particular uuid, and
we _wait for the response by the client_ before we notify all other clients that
a new client joined the collective.

On the client side, all we have to do for this to work is:

```javascript
class Client {
    constructor(socket, ClientAPI) {
        let server = this.server = ClientAPI.createServer(socket, this);
        server.onDisconnect(() => console.log(`client> disconnected from server.`))
    }

    async register(clientId) {
      this.id = clientId;
      return true;
    }
}
```

And that's it: when the server calls `await client.user.register(clientId)`, the async-socket.io
framework takes care of the actual web socket transportation and response handling, so on the one
end we can call `await endpoint.namespace.someFunction()` and on the other end we can simply 
write out that `async someFunction()` and "things work". If we make the function return any 
non-falsey value, the framework will make sure that the called gets that value as if it was using
a call to a local reference.

Have a look at the [demo](https://github.com/Pomax/async-socket.io/tree/master/demo) directory,
to see an example of a simple client/server setup with code in place that starts a server
and three clients, has the server inform each client what their `id` is when they connect,
adding them to a list of known users, and where each client asks the server for that user list
after connecting, automatically getting notified of individual join/leave actions when they
occur.

You can run this demo using `npm test` in the `async-socket.io` directory.
