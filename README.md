# Socketless

Socketless is a websocket-based RPC-like framework for client/server implementations, written specifically so you never have to write any websocket or RPC code. As far as the clients and servers know, there is no network, code is just "normal function-based API code", with the only caveat being that function calls that need to return values will do so asynchronously. Just like any other `async`/`await` code you're used to writing.

# Table of contents

- [Installation](#installation)
- [A short example](#a-short-example)
- [Check out the docs](#i-want-to-know-more)
- [Get in touch](#what-if-i-want-to-get-in-touch)

# Installation

Socketless can be installed from https://www.npmjs.com/package/socketless using your package manager of choice, and can be used in Deno by importing `"npm:socketless@1"`.

Note that because `socketless` is code that by definition needs to run server-side, it does not provide a precompiled single-file library in a `dist` directory, nor should it ever (need to) be part of a bundling task. It comes with its own mechanism for letting you connect to the system using a browser, as explained in the ["how to..."](docs/HOWTO.md) docs.

The current version of `socketless` is v1.0.7 [(See the change-log for more information)](./docs/CHANGELOG.md).

# A short example

A short example is the easiest way to demonstrate how Socketless works.

If we have the following client class:

```js
class ClientTimeManager {
  tick(dateTime) {
    console.log(`server date-time is ${dateTime}`);
  }
}

class ClientClass {
  constructor() {
    console.log("client> created");
    this.timeManager = new ClientTimeManager();
  }

  async onConnect() {
    console.log("client> connected to server");
    setTimeout(() => this.server.disconnect(), 3000);
    console.log("client> disconnecting in 3 seconds");
  }

  async register() {
    this.name = `user${Date.now()}`;
    this.registered = await this.server.setName(this.name);
    console.log(`client> registered as ${this.name}: ${this.registered}`);
  }
}
```

And we have the following server class:

```js
class ServerClass {
  constructor() {
    console.log("server> created");
    setInterval(
      () =>
        this.clients.forEach((client) => client.timeManager.tick(Date.now())),
      1000
    );
  }

  async onConnect(client) {
    console.log(
      `server> new connection, ${this.clients.length} clients connected`
    );
    client.register();
  }

  async onDisconnect(client) {
    console.log(`server> client ${client.name} disconnected`);
    if (this.clients.length === 0) {
      console.log(`server> no clients connected, shutting down.`);
      this.quit();
    }
  }

  async setName(client, name) {
    console.log(`server> client is now known as ${name}`);
    client.name = name;
  }
}
```

Then we can make things "just work" by writing a server application that starts up a server, and then starts up a client to connect to that server:

```js
import { ClientClass } from "./client.js";
import { ServerClass } from "./server.js";
import { linkClasses } from "socketless";

const { createClient, createServer } = linkClasses(ClientClass, ServerClass);
const { server, webserver } = createServer();
const PORT = process.env.PORT ?? 8000;

webserver.listen(PORT, () => {
  const client = createClient(`http://localhost:${PORT}`);
});
```

By running the above code, we should see the following output on the console:

```bash
server> created
client> created
server> new connection, 1 clients connected
client> connected to server
client> disconnecting in 3 seconds
server> client is now known as user1582572704133
client> registered as user1582572704133: true
client> server date-time is ....
client> server date-time is ....
server> client user1582572704133 disconnected
server> no clients connected, shutting down.
```

Note that when the client is created, it's not passed the reference to the server, but instead it's given a URL to connect to: the client and server can, and typically will, run on completely different machines "anywhere on the internet". As long as the same versions of the client and server classes are used by all parties, there's nothing else you need to do.

#### _It just works._

## I want to know more!

That's the spirit! Also, if this didn't whet your appetite you probably didn't need this library in the first place, but let's cut to the chase: install this library, have a look at the [documentation](./docs), probably start at the ["how to ..."](/docs/HOWTO.md) docs, and let's get this working for you!

## What if I want to get in touch?

I mean there's always the issue tracker, that's a pretty solid way to get in touch in a way that'll let us cooperate on improving this library. However, if you just want to fire off a social media message, find me over on [Mastodon](https://mastodon.social/@TheRealPomax) and give me a shout.
