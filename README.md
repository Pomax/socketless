# Socketless

Socketless is a websocket-based RPC-like framework for client/server implementations, written specifically so you never have to write any websocket or RPC code. As far as the clients and servers know, there is no network, code is just "normal function-based API code", with the only caveat being that function calls that need to return values will do so asynchronously. Just like any other `async`/`await` code you're used to writing.

### The current version of `socketless` is `v4.0.1`
[(See the changelog for more information)](./docs/CHANGELOG.md)

# Table of contents

- [Installation](#installation)
- [A short example](#a-short-example)
- [Check out the docs](#i-want-to-know-more)
- [Get in touch](#what-if-i-want-to-get-in-touch)

# Installation

The `socketles` library can be installed from https://www.npmjs.com/package/socketless using your package manager of choice, and can be used in Deno by importing `"npm:socketless@4"`.

**Note**: This library is written and exposed as modern ESM code, and relies on enough modern JS language features that this library is only guaranteed to work on the current generation of browsers, and current LTS version of Node. No support for older/dead browsers or end-of-life versions of Node is offered.

## Using `socketless` in the browser

As the `socketless` library is code that by definition needs to run server-side, it does not provide a precompiled single-file library in a `dist` directory, nor should you ever (need to) bundle `socketless` into a front-end bundle. Instead, the library has its own mechanism for letting browsers connect, shown off in the following example and explained in more detail in the ["how to..."](docs/HOWTO.md) documentation.

# A short example

A short example is the easiest way to demonstrate how Socketless works. Normally, we'd put the client and server classes, as well as the code that links and runs client and server instances in their own files, but thing'll work fine if we don't, of course:

```js
/**
 * Make our server class announce client connections:
 */
export class ServerClass {
  onConnect(client) {
    console.log(`[server] A client connected!`);
  }
  // And give the server a little test function that both logs and returns a value:
  async test() {
    console.log(`[server] test!`);
    return "success!";
  }
}
```

```js
/**
 * Then, make our client class announce its own connection, as well as browser connections:
 */
export class ClientClass {
  onConnect() {
    console.log(`[client] We connected to the server!`);
  }
  onBrowserConnect() {
    console.log(`[client] A browser connected!`);
    this.setState({ goodToGo: true });
  }
}
```

```js
/**
 * Then we can link those up as a `socketless` factory and run a client/server setup:
 */
import { linkClasses } from "socketless";
const { createWebClient, createServer } = linkClasses(ClientClass, ServerClass);
const { server, webserver } = createServer();

// For demo purposes, let's use some hardcoded ports:
const SERVER_PORT = 8000;
const CLIENT_PORT = 3000;

// So, first: create our server and start listening for connections...
webserver.listen(SERVER_PORT, () => console.log(`Server running...`));

// ...then create our client, pointed at our server's URL...
const serverURL = `http://localhost:${SERVER_PORT}`;
const publicDir = `public`;
const { client, clientWebServer } = createWebClient(serverURL, publicDir);

// ...and have that start listening for browser connections, too:
clientWebServer.listen(CLIENT_PORT, () => {
  console.log(`Client running...`);
  const clientURL = `http://localhost:${CLIENT_PORT}`;
  import(`open`).then(({ default: open }) => {
    console.log(`Opening a browser...`);
    open(clientURL);
  });
});
```

Of course we'll need something for the browser to load so we'll create a minimal `index.html` and `setup.js` and stick them both in a `public` dir. First our index file:

```html
<!doctype html>
<html lang="en-GB">
  <head>
    <meta charset="utf-8" />
    <title>Let's test our connections!</title>
    <script src="setup.js" type="module" async></script>
  </head>
  <body>
    <!-- we only need the dev tools console tab for now -->
  </body>
</html>
```

And then our browser JS:

```js
/**
 * We don't need to put a "socketless.js" in our public dir,
 * this is a "magic import" provided by socketless itself:
 */
import { createBrowserClient } from "./socketless.js";

/**
 * And then we can build a browser UI thin client that will
 * automatically connect to the real client:
 */
createBrowserClient(
  class {
    async init() {
      console.log(`[browser] We're connected to our web client!`);
      console.log(`[browser] Calling test:`, await this.server.test());
    }
    update(prevState) {
      console.log(`[browser] State updated, goodToGo: ${this.state.goodToGo}`);
    }
  }
);
```

Then we can run the above code, and see following output on the console:

```
Server running...
Client running...
[server] A client connected!
[client] We connected to the server!
Opening a browser...
[client] A browser connected!
[server] test!
```

And then if we check the browser's developer tools' `console` tab, we also see:

```
[browser] We're connected to our web client!           setup.js:14:15
[browser] State updated, goodToGo: true                setup.js:18:15
[browser] Calling test: success!                       setup.js:15:15
```

It's important to note that we don't create clients by passing them a direct reference to the `server` instance, but instead it's given a URL to connect to: the client and server can, and typically will, run on completely different machines "anywhere on the internet". As long as the same versions of the client and server classes are used on both machines (because, say, you're running on the same branch of the same git repo) then there's nothing else you need to do...

#### _It just works._

## I want to know more!

That's the spirit! Also, if this didn't whet your appetite you probably didn't need this library in the first place, but let's cut to the chase: install this library, have a look at the [documentation](./docs), probably start at the ["how to ..."](/docs/HOWTO.md) docs, and let's get this working for you!

## What if I want to get in touch?

I mean there's always the issue tracker, that's a pretty solid way to get in touch in a way that'll let us cooperate on improving this library. However, if you just want to fire off a social media message, find me over on [Mastodon](https://mastodon.social/@TheRealPomax) and give me a shout.
