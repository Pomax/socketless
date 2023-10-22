# Developer documentation

See the [ARCHITECTURE.md](ARCHITECTURE.md) document for details that won't be repeated here.

- general proxy handling is done in the `src/upgraded-socket.js` file.

- For servers, the `ws` and `webserver` properties are tacked on in the `src/index.js` file, `createServer` function.
- For clients, the `params` property is tacked on in the `src/index.js` file, `createClient` function, and the `id` is established in the same function as part of the bare websocket `handshake:setid` handling.
- for web clients, the `sid` authentication token is checked in the `src/index.js` file, `createWebClient` functions. Similarly, the `ws` and `webserver` properties are bound in the same function. In addition, the `syncState` call is defined there, as well. This is also where all `:response` messages get intercepted.
- State syncing on the browser side is handled in `src/upgraded-socket.js`, in the `router` function, in the `if (state && receiver === BROWSER)` block.

RPC calls are compared to a list of "forbidden" calls in the router function, which are pulled from the server, client, and webclient classes using their static `disallowedCalls` property, declared in `src/classes.js` and `src/webclient/classes.js`.

Function calls are proxied through the `SocketProxy` class exported by `src/upgraded-socket.js`.
