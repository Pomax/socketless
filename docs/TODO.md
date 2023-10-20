This document mostly exists to let me track whether we're at v1 or not yet.

# Basic work

- [x] refactor the code from bare functions to classes
- [x] implement diff-based state update for web client
  - [x] state messaging sequence numbers
  - [x] full vs. diffed state transmission
- [x] disallow calling Base functions over RPC, except for the client's `syncState` and `quit`,
      by the browser, and `disconnect`, by the server (i.e. a server kick).
- [] can clients call server.clients[0].something? Or the server call client.server.some.function?
- [x] figure out a way to turn "generateSocketless" into something that can be bundled.
- [x] "get user input from browser" mechanism for client code when this.browser===true, after looking at what the MJ implementation actually needs/uses.
- [] web clients need a way to fully shut down (i.e. shut down their web server and their socket server). Right now the browser can force the client to disconnect, but it won't shut down.
  - this might be a docs issue...

# Tests

- [] create new basic tests
  - [x] can start up constellation
    - [x] server + client
    - [x] server + webclient
    - [x] (server +) webclient + browser
  - [] disallowed access
    - [x] client to server
    - [x] server to client
    - [x] webclient to server
    - [x] server to webclient
    - [] webclient to browser?
    - [] browser to webclient?

# Documentation

- [x] document the diagram of "how things work"
- [] rewrite the docs (in progress)

  - [x] architecture document
  - [x] "how to" document
  - [x] pure API document

- [] document the places where calls get resolved.

# Demos

create several new demos

- [x] simple client/server demo
- [] simple client/server demo with auth?
- [] terminal based chat client
- [] multiplayer game: mahjong
  - [] terminal client
  - [] web client

# Open issues

- the browser's `this.socket` feels like it should not be necessary and exposed, _or_ it should be a `this.client` and be a proxy socket?
- [x] add middleware back in for the webclient?
- [x] update addRoute to allow middleware?

- [] should clients have a `.reconnect()` so the browser can control the client's connection to the server?
- [] should the browser have a .quit() that shuts down the client completely?

# Useful for dev

"why-is-node-running": "^2.2.2"
