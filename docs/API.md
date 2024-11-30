# API Documentation

## **The `socketless` library**

### exported properties:

- `ALLOW_SELF_SIGNED_CERTS`, a `Symbol` used to explicitly allow HTTPs connections that are considered "unsafe" due to self-signed certificates.

### exported methods:


- `createServer(ServerClass, [serverOrHttpsOptions])` yielding `{ server, webServer }`

  The `serverOrHttpsOptions` argument may either be an instance of a plain Node `http` or `https` server, which includes things like Express servers (as obtained from `app.listen()`), or an options object that provides the HTTPs key and cert string values, using the form `{ key: string, cert: string }`.

- `createClient(ClientClass, serverURL, [ALLOW_SELF_SIGNED_CERTS])` yielding `client`

  The `serverURL` may be either `http://`, `https://`, `ws://` or `wss://`, http URLs are automatically converted to websocket URLs. To allow secure connections that use self-signed certificates, the optional `ALLOW_SELF_SIGNED_CERTS` must be the exported symbol listed above.

- `createWebClient(ClientClass, serverURL, publicDir, [httpsOptions], [ALLOW_SELF_SIGNED_CERTS])` yielding `{ client, clientWebServer}`

  The `serverURL` may include an `?sid=...` query argument, in which case browsers must connect to the client's web server with that same argument. Failure to do so will result in a 404 when requesting `socketless.js`, and websocket connection requests to the client's server URL will not be honoured.

  The `httpsOptions` argument must be an options object that provides the HTTPs key and cert values in the form `{ key: string, cert: string }`. To allow secure connections that use self-signed certificates, the optional `ALLOW_SELF_SIGNED_CERTS` must be the exported symbol listed above.

- `linkClasses(ClientClass, ServerClass)`

This yields a factory object with three functions, useful for code that creates both servers and clients in the same script:

- `createServer([serverOrHttpsOptions])` yielding `{ server, webServer }`

  This is the same as the `createServer` function that `socketless` exports, but without needing to specify the `ServerClass` again.

- `createClient(serverURL, [ALLOW_SELF_SIGNED_CERTS])` yielding `client`

  This is the same as the `createClient` function that `socketless` exports, but with needing to specify the `ClientClass` again.

- `createWebClient(serverURL, publicDir, [httpsOptions], [ALLOW_SELF_SIGNED_CERTS])` yielding `{ client, clientWebServer}`

  This is the same as the `createWebClient` function that `socketless` exports, but with needing to specify the `ClientClass` again.

## **Server classes**

Note that the instance properties for a server will not be available until after the constructor has finished running. Also note that if a constructor implementation exists, it will be called without any arguments.

### instance properties

- `this.clients`, an array of clients, with each client a local proxy to a remote, supporting the API defined in your ClientClass.

### methods

- `init()`, a method that gets run immediately after construction, with all instance properties available.
- `lock(object, unlock = (client)=>boolean)`, a method to lock down server property access to only those clients for which the passed unlock function returns `true`.
- `quit()`, a method to close all connections and shut down the server.

### event handlers

- `onError(error)`, triggers if there are websocket errors during connection negotiation.
- `onConnect(client)`, triggers after a client has connected. `client` is a proxy, and will have already been added to `this.clients`.
- `onDisconnect(client)`, triggers after a client has disconnected. `client` is a proxy, and will have already been removed from `this.clients`.
- `onQuit()`, triggered before the server closes its web server and websocket server.
- `teardown()`, triggered after the web server and websocket server have been shut down.

### Web server instances

Web servers are Node http(s) servers (even when using something like Express), with the following addition

- `.addRoute(relativeURL, [...middlewareHandlers], finalHandler)` adds explicit route handling for a specific URL endpoint. In this:
  - `[...middleWare]` is zero or more middleware handlers of the form `(req, res, next) => { ... }` where a call to `next()` will make the next middleware function on the list run after the current one completes, or if there are no more middleware functions, `finalHandler` will get called.
  - `finalHandler` is a function with signature `(req, res) => { ... }` and is required as last function in the route handling.
  - The `req` argument is a Node `http.ClientRequest` object, but with query arguments split out as `req.params`, and POST/PUT body content split out as `req.body`. Note that the body will be plain string data.
  - The `res` argument is a Node `http.ClientResponse` object.

## **Client classes**

As the instance properties for a client will not be available until _after_ the constructor has finished, having a constructor in the client class is strongly discouraged. If present, it will be called without arguments. Instead, if implemented, the client's `init` function will be called after construction to allow for initial setup with full access to all instance properties.

### instance properties

- `this.id`, an id known to both the client and server.
- `this.params`, a parameter object derived from the serverURL.
- `this.server`, a local proxy for the server, supporting the API defined in your ServerClass.

### methods

- `init()`, a method that gets run immediately after construction, with all instance properties available.
- `disconnect()`, a method to disconnect the client from the server.
- `reconnect()`, a method to reconnect the client to the server.

### event handlers

- `onError(error)`, triggers if there are websocket errors during connection negotiation.
- `onConnect()`, triggers after the client has connected to the server.
- `onDisconnect()`, triggers after the client has disconnected from the server.

## **Web client classes**

This is considered a `ClientClass`, with the additional properties and events that are only used when a client instance is created through the `createWebClient()` function.

As the instance properties for a web client will not be available until _after_ the constructor has finished, having a constructor in the web client class is strongly discouraged. If present, it will be called without arguments. Instead, if implemented, the web client's `init` function will be called after construction to allow for initial setup with full access to all instance properties.

### instance properties

Web client classes inherit the client instance properties, and add the following:

- `this.state`, a state object that gets (one-way) synced to the browser whenever modified.
- `this.browser`, a local proxy for the browser, supporting the API defined in your BrowserClientClass.

### methods

- `init()`, a method that gets run immediately after construction, with all instance properties available.
- `disconnect()`, a method to disconnect the client from the server.

### event handlers

Web client classes inherit the client methods, and add the following:

- `onBrowserConnect()`, triggered after a browser connects.
- `onBrowserDisconnect()`, triggered after a browser disconnects.
- `onQuit()`, triggered before the web client closes its web server and websocket server.
- `teardown()`, triggered after the web server and websocket server have been shut down.

### Web server instances

The webclient web server has the same functionality as those generated through the `createServer()` factory method, details for which are listed in the Server Classes section above.

## **Browser client classes**

A constructor is strongly discouraged, initialization should be handled in `init()` instead. If present, the constructor will be called without arguments.

### instance properties

- `this.server`, a local proxy for the server, supporting the API defined in your ServerClass.
- `this.socket`, the plain websocket connection to the client that the browser connected to.
- `this.state`, a state object that reflects the connected web client's current state.
- `this.connected`, a flag that indicates whether we're connected to our web client.
- `this.disconnect()`, allows the browser to intentionally disconnect from the web client, used to intentionally trigger `.onBrowserDisconnect` at the web client.
- `this.reconnect()`, allows the browser to reconnect to their web client.

### event handlers

- `init()`, triggered as last step in bootstrapping the browser client.
- `update(prevState)`, triggered any time the web client's state changes.
