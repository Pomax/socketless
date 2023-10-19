# API Documentation

## The `socketless` library

### exported properties:

- `ALLOW_SELF_SIGNED_CERTS`, used to explicitly allow "unsafe" HTTPs connections based on self-signed certificates.

### exported methods:

- `linkClasses(ClientClass, ServerClass)`

This yields a factory object with three functions:

- `createServer([serverOrHttpsOptions])`, where `serverOrHttpsOptions` may either be an instance of a plain `http` or `https` server, or an Express server (as obtained from `app.listen()`), or an options object that provides the HTTPs key and cert values in the form `{ key: string, cert: string }`.
- `createClient(serverURL, [ALLOW_SELF_SIGNED_CERTS])`
- `createWebClient(serverURL, publicDir, [httpsOptions], [ALLOW_SELF_SIGNED_CERTS])`, where `httpsOptions` is an options object that provides the HTTPs key and cert values in the form `{ key: string, cert: string }`.

## Server class

For security reasons, a constructor is strongly discouraged. If present, it will be called without arguments.

### instance properties

- `this.clients`, an array of clients, with each client a local proxy to a remote, supporting the API defined in your ClientClass.

### methods

- `quit()`, a method to close all connections and shut down the server.

### event handlers

- `onConnect(client)`, triggers after a client has connected. `client` is a proxy, and will have already been added to `this.clients`.
- `onDisconnect(client)`, triggers after a client has disconnected. `client` is a proxy, and will have already been removed from `this.clients`.
- `onQuit()`, triggered before the server closes its web server and websocket server.
- `teardown()`, triggered after the web server and websocket server have been shut down.

## Client class

For security reasons, a constructor is strongly discouraged. If present, it will be called without arguments.

### instance properties

- `this.server`, a local proxy for the server, supporting the API defined in your ServerClass.

### methods

- `disconnect()`, a method to disconnect the client from the server.

### event handlers

- `onConnect()`, triggers after the client has connected to the server.
- `onDisconnect()`, triggers after the client has disconnected from the server.

## Web client class

This is considered a `ClientClass`, with the additional properties and events that are only used when a client instance is created through the `createWebClient()` function.

For security reasons, a constructor is strongly discouraged. If present, it will be called without arguments.

### instance properties

- `this.server`, a local proxy for the server, supporting the API defined in your ServerClass.
- `this.browser`, a local proxy for the browser, supporting the API defined in your BrowserClientClass.
- `this.state`, a state object that gets (one-way) synced to the browser whenever modified.

### methods

- `disconnect()`, a method to disconnect the client from the server.

### event handlers

- `onConnect()`, triggered after the client connects to the server.
- `onDisconnect()`, triggered after the client gets disconnected from the server.
- `onBrowserConnect()`, triggered after a browser connects.
- `onBrowserDisconnect()`, triggered after a browser disconnects.
- `onQuit()`, triggered before the web client closes its web server and websocket server.
- `teardown()`, triggered after the web server and websocket server have been shut down.

## Browser client class

A constructor is strongly discouraged, initialization should be handled in `init()` instead. If present, the constructor will be called without arguments.

### instance properties

- `this.server`, a local proxy for the server, supporting the API defined in your ServerClass.
- `this.socket`, the plain websocket connection to the client that the browser connected to.
- `this.state`, a state object that reflects the connected web client's current state.

### event handlers

- `init()`, triggered as last step in bootstrapping the browser client.
- `update(prevState)`, triggered any time the web client's state changes.
