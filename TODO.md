# Basic work

- [x] refactor the code from bare functions to classes
- [x] implement diff-based state update for web client
  - [x] state messaging sequence numbers
  - [x] full vs. diffed state transmission
  - [ ] call .update with both the full state and the changeset wrt the previous state
- [x] disallow calling Base functions over RPC, except for the client's `syncState` and `quit`,
      by the browser, and `disconnect`, by the server (i.e. a server kick).
- [x] create new tests
- [x] figure out a way to turn "generateSocketless" into something that can be bundled.
- [x] "get user input from browser" mechanism for client code when this.browser===true, after looking at what the MJ implementation actually needs/uses.
- [ ] web clients need a way to fully shut down (i.e. shut down their web server and their socket server). Right now the browser can force the client to disconnect, but it won't shut down.

# Documentation

- [ ] document the diagram of "how things work"
- [ ] rewrite the docs

# Demos

- [ ] create several new demos
  - [ ] simple client/server demo
  - [ ] simple client/server demo with auth
  - [ ] terminal based BBS
  - [ ] multiplayer game: mahjong
    - [ ] terminal client
    - [ ] web client

