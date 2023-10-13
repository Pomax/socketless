# Basic work

- [x] refactor the code from bare functions to classes
- [x] implement diff-based state update for web client
  - [x] state messaging sequence numbers
  - [x] full vs. diffed state transmission
  - [ ] call .update with both the full state and the changeset wrt the previous state
- [x] disallow calling Base functions over RPC, except for the client's `syncState` and `quit`,
      by the browser, and `disconnect`, by the server (i.e. a server kick).
- [ ] create new tests

# Documentation

- [ ] document the diagram of "how things work"
- [ ] rewrite the docs

# Demos

- [ ] create several new demos
  - [ ] simple client/server demo
  - [ ] terminal based BBS
  - [ ] multiplayer game: mahjong
    - [ ] terminal client
    - [ ] web client

# open questions

- how to make the browser call client functions, rather than proxy to server? (only one socket)
