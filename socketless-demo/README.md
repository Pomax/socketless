# Socketless demos

This is a collection of demos that show off how to use the [socketless](https://github.com/Pomax/socketless) framework for websocket client/server implementations.
There are currently three demos: two simple functionality demos, and one full fledged multiplayer game.

  - [a simple example similar to the code above, with one web client](#a-simple-example-npm-run-simple),
  - [a true distributed version of the simple example, minus the web client](#a-distributed-simple-example-npm-run-simple-distributed),
  - [the simple example enriched with a web client](#a-simple-example-with-web-clients-npm-run-simple-web), and
  - [a full blown multiplayer mahjong game implemented using `socketless`](#multiplayer-mahjong-npm-run-game).


## A simple example: `npm run simple`

The demo starts up a server, followed by several clients. 10 seconds after joining, each client (including the webclient) will set out a chat message, and after an additional 5 seconds, it will disconnect from the server. Once the last client disconnects, the server will shut itself down.

All of this is coordinated in `index.js`, with the client/server API declared in the `Client.js` and `Server.js` files.


## A distributed simple example: `npm run simple:distributed`

This is the same test as the simple test, where each client is executed as an independent process (using the `spawn` command), to demonstrate things still work when the client and server code has no knowledge of each other, beyond knowing the shared API.

Like in the simple example, running of the clients and server is coordinated in `index.js`, and the client/server API is literally the same as the `simple` example (it uses those exact same files). However, instead of creating objects directly, `index.js` will spawn external processes that run `test-server.js` and `test-client.js`, which build the server and clients respectively, in order to demonstrate that server and client don't need to be created and run by the same script.


## A simple example with web clients: `npm run simple:web`

This test is similar to the `simple` demo, except it add web clients to the mix.

The demo starts up a server, and then starts up a web client, which a browser can connect to on [http://localhost:1234](http://localhost:1234), followed by a number of regular clients. Like before, 10 seconds after joining, each client (including the webclient) will set out a chat message, and after an additional 5 seconds each regular client will disconnect from the server. The web client, however, needs to be told to "quit" through its browser interface. Once all regular clients plus the web client have disconnected from the server, the server will shut itself down.

You'll notice that there is a `public` directory in the web demo: this is where the web client servers its `index.html` and style/JS from. If you look at the `startWebClient()` function in `index.js` you will see the following code:

```javascript
  const webclient = ClientServer.createWebClient(
    serverURL,
    `${__dirname}/public`,
    { directSync: true }
  );
```

This creates a web client similar to a regular client, by telling it which URL the server is running on, but it also tells the webclient what the `public` directory is that it should use to server web content from. Finally, the third argument turns on direct syncing, rather than syncing through a `state` variable. This is mostly because it makes for easier code for a demo (see the `socketless` documentation on the difference between direct and state-based syncing), but if you want an example that relies on syncing through a `state` variable, read on...

## Multiplayer mahjong: `npm run game`.

This is an ***elaborate example*** of how you can use `socketless` to implement a multiplayer game with all the bells and whistles you need, with client/web synchronisation through a "shared" `state` variable, with quite a lot of code for coordinating a simple "lobby" of sorts, creating, joining, and starting games, and coordinating play actions both between the clients and the server, as well as between the clients amongst themselves (using broadcasting).

The code is lavishly commented, so start reading at `demo/game/index.js` and branch out to other files as questions arise bout how things work.
