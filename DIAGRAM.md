Diagram:

### basic

```
server (webserver) ← (browser)
  ⇑
  ╚⇒ client
```

### web

```
server (webserver) ←───────┐
  ⇑                        │
  ╚⇒ client (webserver) ←┐ │
        ⇑                │ │
        ║                │ │
        ╚═⇒  browser ────┴─┘
```

### How it works

- The server runs both a web server and websocket server.

  - socket connections are upgraded from http: to ws:
  - the webserver may be prespecified - if not, the code builds one
  - If the code is left to build one, the code will need to use addRoute for browser-accessible content.

- If clients are of the "WebClient" type, clients run a webserver that accepts browser websocket connects,
  as well as serves the browser "socketless.js" library required to play a role in the system.

#### server

The server class comes with the following prespecified:

- `this.clients`, and array of clients, each a socket proxy of the connected client
- `this.quit()`, a method to close all connections and shut down the server.

The server class may implement the following:

- `onConnect(client)`, triggers after a client has connected
- `onDisconnect(client)`, triggers after a client has disconnected
- `onQuit()`, triggered before the server closes its web server and websocket server.
- `teardown()`, triggered after the web server and websocket servers have been shut down.

#### client

The client class comes with the following prespecified:

- `this.server`, a proxy of the server
- `this.browser`, a proxy of the browser, if this is a web client. Note that calls to functions on this.browser do _not_ time out, they stay waiting until the browser
- `this.state`, a state object that can be used to store client data. This object gets automatically synchronized to the browser, if this is a web client with a connected browser.

This client class may implement the following:

- `onConnect()`, triggered after the client connects to the server
- `onBrowserConnect()`, if this is a web client, triggered after a browser connects
- `onDisconnect()`, triggered after the client gets disconnected from the server
- `onBrowserDisconnect()`, if this is a web client, triggered after a browser disconnects
- `onQuit()`, if this is a web client, triggered before the server closes its web server and websocket server.
- `teardown()`, if this is a web client, triggered after the web server and websocket servers have been shut down.

#### browser

Browser clients created using the browser-side `createWebclient` function come with the following prespecified:

- `this.server`, a proxy for the main server
- `this.socket`, a plain socket to the client (it should almost never be necessary to interact with this)
- `this.quit()`, a convenience method to disconnect from the main server

Browser clients will want to implement:

- `init()`, a function that is called as part of the connection process. Any setup should be done inside `init()`, not a constructor.
- `update(prevState)`, a function that is called any time the client's state gets reflected to the browser.
