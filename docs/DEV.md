# Developer documentation

See the [ARCHITECTURE.md](ARCHITECTURE.md) document for details that won't be repeated here.

## Testing

run `npm test`, which will:

- lint the code using `tsc`,
- if there are no linting errors, autoformats the code using `prettier`, and
- runs all tests in the `./test` dir using `mocha`.

## Working on the code itself

Some notes if you want to work on this code (in addition to the architecture documentation):

- general proxy handling is done in the `src/upgraded-socket.js` file.
- For servers, the `ws` and `webserver` properties are tacked on in the `src/index.js` file, `createServer` function.
- For clients, the `params` property is tacked on in the `src/index.js` file, `createClient` function, and the `id` is established in the same function as part of the bare websocket `handshake:setid` handling.
- for web clients, the `sid` authentication token is checked in the `src/index.js` file, `createWebClient` functions. Similarly, the `ws` and `webserver` properties are bound in the same function. In addition, the `syncState` call is defined there, as well. This is also where all `:response` messages get intercepted.
- State syncing on the browser side is handled in `src/upgraded-socket.js`, in the `router` function, in the `if (state && receiver === BROWSER)` block.

RPC calls are compared to a list of "forbidden" calls in the router function, which are pulled from the server, client, and webclient classes using their static `disallowedCalls` property, declared in `src/classes.js` and `src/webclient/classes.js`.

### Class hierarchies

Server and classes are built as extensions on the user-provided class.

- The `createServer` function uses a `ServerClass extends UserProvidedClass`
- The `createClient` function uses a `ClientClass extends UserProvidedClass`
- The `createWebClient` function uses a `WebClientClass extends <ClientClass used by createClient>`

to ensure user-implemented functions get called, the `socketless` classes defined their functions in terms of the super class:

```js
async someSocketlessFunction() {
  super.someSocketlessFunction?.();
}
```

### Function call routing

Function calls are proxied through the `SocketProxy` class exported by `src/upgraded-socket.js`, and are resolved on step at a time using code similar to the following code block:

```js
const stages = eventName.split(`:`);
let response = undefined;
let error = undefined;

// Are we even allowed to resolve this chain?
const [first] = stages;
let forbidden = origin.__proto__?.constructor.disallowedCalls ?? [];
if (first && forbidden.includes(first)) {
  error = `Illegal call: ${first} is a protected property`;
}

// Find the function to call:
let context = origin;
let callable = origin;
if (!error) {
  try {
    while (stages.length) {
      context = callable;
      callable = callable[stages.shift()];
    }
    if (receiver === `server`) payload.unshift(this[PROXY]);
  } catch (e) {
    error = e.message;
  }
}

// then call it (or capture an error)
if (!error) {
  try {
    response = (await callable.bind(context)(...payload)) ?? true;
  } catch (e) {
    const chain = eventName.replaceAll(`:`, `.`);
    error = `Cannot call [[${receiver}]].${chain}, function is not defined.`;
  }
}
```

That is, if we're resolving a.b.c.d() we step through this as:

1. context = a, callable = a
1. context = a, callable = b
1. context = b, callable = c
1. context = c, callable = d

And then call `callable.bind(context)(...args)` so that the function gets called with the "function owner" as its call context.
