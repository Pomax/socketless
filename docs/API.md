# API Documentation

## **The `socketless` library**

### exported properties:

- `ALLOW_SELF_SIGNED_CERTS`, a `Symbol` used to explicitly allow HTTPs connections that are considered "unsafe" due to self-signed certificates.

### exported methods:

- `linkClasses(ClientClass, ServerClass)`

This yields a factory object with three functions:

- `createServer([serverOrHttpsOptions])` yielding `{ server, webserver }`

  The `serverOrHttpsOptions` argument may either be an instance of a plain Node `http` or `https` server, which includes things like Express servers (as obtained from `app.listen()`), or an options object that provides the HTTPs key and cert string values, using the form `{ key: string, cert: string }`.

- `createClient(serverURL, [ALLOW_SELF_SIGNED_CERTS])` yielding `client`

  The `serverURL` may be either `http://`, `https://`, `ws://` or `wss://`, http URLs are automatically converted to websocket URLs. To allow secure connections that use self-signed certificates, the optional `ALLOW_SELF_SIGNED_CERTS` must be the exported symbol listed above.

- `createWebClient(serverURL, publicDir, [httpsOptions], [ALLOW_SELF_SIGNED_CERTS])` yielding `{ client, clientWebServer}`

  The `serverURL` may include an `?sid=...` query argument, in which case browsers must connect to the client's web server with that same argument. Failure to do so will result in a 404 when requesting `socketless.js`, and websocket connection requests to the client's server URL will not be honoured.

  The `httpsOptions` argument must be an options object that provides the HTTPs key and cert values in the form `{ key: string, cert: string }`. To allow secure connections that use self-signed certificates, the optional `ALLOW_SELF_SIGNED_CERTS` must be the exported symbol listed above.

## **Server classes**

For security reasons, a constructor is strongly discouraged. If present, it will be called without arguments.

### instance properties

- `this.clients`, an array of clients, with each client a local proxy to a remote, supporting the API defined in your ClientClass.

### methods

- `quit()`, a method to close all connections and shut down the server.

### event handlers

- `onError(error)`, triggers if there are websocket errors during connection negotiation.
- `onConnect(client)`, triggers after a client has connected. `client` is a proxy, and will have already been added to `this.clients`.
- `onDisconnect(client)`, triggers after a client has disconnected. `client` is a proxy, and will have already been removed from `this.clients`.
- `onQuit()`, triggered before the server closes its web server and websocket server.
- `teardown()`, triggered after the web server and websocket server have been shut down.

## **Client classes**

For security reasons, a constructor is strongly discouraged. If present, it will be called without arguments.

### instance properties

- `this.id`, an id known to both the client and server.
- `this.params`, a parameter object derived from the serverURL.
- `this.server`, a local proxy for the server, supporting the API defined in your ServerClass.

### methods

- `disconnect()`, a method to disconnect the client from the server.

### event handlers

- `onError(error)`, triggers if there are websocket errors during connection negotiation.
- `onConnect()`, triggers after the client has connected to the server.
- `onDisconnect()`, triggers after the client has disconnected from the server.

## **Web client classes**

This is considered a `ClientClass`, with the additional properties and events that are only used when a client instance is created through the `createWebClient()` function.

For security reasons, a constructor is strongly discouraged. If present, it will be called without arguments.

### instance properties

Web client classes inherit the client instance properties, and add the following:

- `this.state`, a state object that gets (one-way) synced to the browser whenever modified.
- `this.browser`, a local proxy for the browser, supporting the API defined in your BrowserClientClass.

### methods

- `disconnect()`, a method to disconnect the client from the server.

### event handlers

Web client classes inherit the client methods, and add the following:

- `onBrowserConnect()`, triggered after a browser connects.
- `onBrowserDisconnect()`, triggered after a browser disconnects.
- `onQuit()`, triggered before the web client closes its web server and websocket server.
- `teardown()`, triggered after the web server and websocket server have been shut down.

## **Browser client classes**

A constructor is strongly discouraged, initialization should be handled in `init()` instead. If present, the constructor will be called without arguments.

### instance properties

- `this.server`, a local proxy for the server, supporting the API defined in your ServerClass.
- `this.socket`, the plain websocket connection to the client that the browser connected to.
- `this.state`, a state object that reflects the connected web client's current state.

### event handlers

- `init()`, triggered as last step in bootstrapping the browser client.
- `update(prevState)`, triggered any time the web client's state changes.
