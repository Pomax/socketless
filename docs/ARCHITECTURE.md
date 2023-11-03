# The architecture

### 1. basic client-server

The basic setup consists of:

- One main server.
- _If_ the server has content serving routes, browsers may connect over HTTP.
- One or more clients that can connect to the server.

```
┌─────────┬─────────────┐    ╭───────────╮
│ server <┼- web server │◁───┤ (browser) │
└────▲────┴─────△───────┘    ╰───────────╯
     ║          ┊                              ╭───────────────────────────────╮
     ║      ┌───◇────┐                         │ ─── HTTP(s) call              │
     ╚══════▶ client │                         │ ┄┄┄ WS upgrade call over HTTP │
            └────────┘                         │ ═══ two-way websocket         │
                                               ╰───────────────────────────────╯
```

### 2. client-server with browser connections

The more complex browser-connected client setup consists of:

- One main server.
- _If_ the server has content serving routes, browsers may connect over HTTP.
- One or more clients that can connect to the server.
- _If_ clients are web clients, they also run their own client-specific web server.
- Any number of browsers, connected to a web client's web server.

```
┌─────────┬─────────────┐
│ server <┼- web server ◁─────────────┐
└────▲────┴─────△───────┘             │
     ║          ┊                     │
     ║      ┌───◇─────┬─────────────┐ │
     ╚══════▶ client <┼- web server ◁─┤
            └───▲─────┴─────△───────┘ │
                ║           ┊         │        ╭───────────────────────────────╮
                ║       ╭───◇─────╮   │        │ ─── HTTP(s) call              │
                ╚═══════▶ browser ├───┘        │ ┄┄┄ WS upgrade call over HTTP │
                        ╰─────────╯            │ ═══ two-way websocket         │
                                               ╰───────────────────────────────╯
```

## How it works

The server is a websocket host, and can either be bootstrapped with an existing HTTP(s) server, or can build its own, in order to accept websocket connections from clients (because web sockets start life as an HTTP call with an UPGRADE instruction).

Clients establish their connection using the server's URL.

If clients are of the "WebClient" type, they also run their own web server, which lets browsers connect to them in order establish a state sync loop. The client's state will automatically get sent over to the browser via the web socket, so that the browser code can update the page/DOM accordingly.

### Making parties communicate

Socket negotiation is automatically taken care of as part of client construction, after which the server will add a client entry into its `this.clients` array , and the client gets a `this.server` binding. Both of these are proxies for the other party, allowing bot the server and all clients to call each other's functions as if everything was local code.

E.g. if the client class has a function `setName` accepting a string as argument, then the server can call this function on its first client by using `this.clients[0].setName("some name")`. Or, if the server has a function `startProcess` taking an integer argument, the client can call this using `this.server.startProcess(123)`.

Functions hat return values can be awaited. For example, if the client has a function `getName`, the server could invoke that using `const clientName = await this.clients[0].getName()`. Forgetting to use `await`, or intentionally omitting it, will cause the function call to return a Promise, rather than the function call result.

Note that these proxies _only_ support function calls: trying to access a property as a value property will yield a function proxy object, not the remote object's value by that name, even if it exists. To get and set values, you will need to explicitly have a (set of) function(s) in your client and/or server class(es).

### Working with server instances

Server instances have access to the following pre-specified properties:

- `this.clients`, an array of clients, each a socket proxy of the connected client
- `this.quit()`, a method to close all connections and shut down the server.

Your server class may also implement any of the following event handlers:

- `onError(error)`, triggers if there are websocket errors during connection negotiation.
- `onConnect(client)`, triggers after a client has connected.
- `onDisconnect(client)`, triggers after a client has disconnected.
- `onQuit()`, triggered before the server closes its web server and websocket server.
- `teardown()`, triggered after the web server and websocket servers have been shut down.

### Working with client instances

Client instances have access to the following pre-specified properties:

- `this.id`, an id known to both the client and the server.
- `this.params`, a parameter object derived from the serverURL.
- `this.server`, a proxy of the server.
- `this.browser`, a proxy of the browser, if this is a web client. Note that calls to functions on this.browser do _not_ time out, they stay waiting until the browser.
- `this.state`, a state object that can be used to store client data. This object gets automatically synchronized to the browser, if this is a web client with a connected browser.
- `this.disconnect()`, a method to disconnect this client from the server.
- `this.reconnect()`, a method to reconnect the client to the server.

Your client class may also implement any of the following event handlers:

- `init()`, a method that gets run immediately after construction, with all instance properties available.
- `onError(error)`, triggers if there are websocket errors during connection negotiation.
- `onConnect()`, triggered after the client connects to the server.
- `onBrowserConnect()`, if this is a web client, triggered after a browser connects.
- `onDisconnect()`, triggered after the client gets disconnected from the server.
- `onBrowserDisconnect()`, if this is a web client, triggered after a browser disconnects.
- `onQuit()`, if this is a web client, triggered before the server closes its web server and websocket server.
- `teardown()`, if this is a web client, triggered after the web server and websocket servers have been shut down.

### Working in the browser

Browser client instances created using the browser-side `createBrowserClient` function have access to the following pre-specified properties:

- `this.server`, a proxy for the main server.
- `this.socket`, the _plain_ websocket connection to the client (it should almost never be necessary to interact with this property).
- `this.state`, a state object that reflects the connected web client's current state.
- `this.connected`, a flag that indicates whether we're connected to our web client.
- `this.disconnect()`, allows the browser to intentionally disconnect from the web client, used to intentionally trigger `.onBrowserDisconnect` at the web client.
- `this.reconnect()`, allows the browser to reconnect to their web client.

You will also want to implement the following functions in your browser client class:

- `init()`, a function that is called as part of the connection process. Any setup should be done inside `init()`, not the constructor (while you _may_ have a constructor, you will not have access to the pre-specified properties until `init` gets called).
- `update(prevState)`, a function that is called any time the client's state gets reflected to the browser.
