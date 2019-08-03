# v0.11.5

Removed the `jsonpatch` dependency, saving another 250KB of on-disk footprint. Previously, `rfc6902` did not have a dist dir with a for-browser min.js, but as of v3.0.4 it does, and so `jsonpatch` no longer has any reason to exist as dependency, or in the code.

# v0.11.2, 0.11.3

Tiny tweaks

# v0.11.1

Update the web client `update()` function to be called as `update(state)` purely to spare you having to issue `const state = this.state;` as first line of your update function.

# v0.11.0

Changed how client/webclient state synchronization works: with `directSync` the client instance is reflected to the web client directly. Without it (which is the default behaviour) the client's `this.state` will be reflected as the web client's `this.state`. Previously, the client's `this.state` would be reflected as the web client's state without `this.state` scoping, which was super fragile. This way, things are both more robust, and more obvious: if you're using `this.state`, you're using `this.state` both in the client and the webclient. If you're not... you're not.

Also, I swapped `socket.io`, which was useful for initial prototyping, for `ws`, which is almost 4MB smaller. There's no reason to use a huge socket management library when web sockets are supported by basically everything at this point in time.

# v0.10.0

Fixed the way function names are discovered, so that `SomeClass extends ClientClass` can be used as argument to `createClientServer()`. Previously, only the class's own function names were checked, so an empty class extensions -which you'd expect to inherit all functions- was considered as "not implementing anything". So that was bad and is now fixed.

# v0.9.1

Fixed incorrect dependency path resolution for generating socketless.js for web clients.

# v0.9.0

This version improves the sync mechanism for web clients, using a far more sensible sync locking mechanism: if a synchronization is already in progress, rather than just firing off a second one in parallel, queue up the _signal_ that another sync is required, but do nothing else. When a sync finishes, it checks whether that signal is active, and if so, deactivates it and performs one more sync operation. This means that if 10 sync operations are called in rapid succession, the first call starts a sync, the second call sets the signal, the third through tenth do _nothing_, and when the first sync finishes, it sees that one more sync is required. This saves socket listener allocation, processing, and time. Triple win!

# v0.8.0

This adds a web client, which is a regular client that a browser can connect in order to run a thin-client UI on top of the true client's state. It's pretty frickin sweet. It also comes with a full multiplayer mahjong game demo, because the only way I could thinkg of to properly test and debug the web client code was to sit down and write a serious piece of code with it. It's heavily code-commented, and is probably far more elaborate than you'd expect a tutorial/demonstrator to be.

Good. More projects need full-blown codebases as examples for how to use them.

# v0.7.0

This adds explicit API objects back in, but as optional third argument to `generateClientServer`. It also adds in broadcasting by clients, based on clients knowing their own API and so knowing which function they want to have triggered by a broadcast.

(Server broadcasting is simply calling `this.clients.forEach(c => c.namespace.fname(...)`)

# v0.6.0

This version changes the way you use the library, removing the need for a separate API object at the cost of having to namespace all your functions in your client and server classes. The `generateClientServer` function can no be called with an API object, and must be called as `generateClientServer(ClientClass, ServerClass)` instead. This will perform auto-discovery of all the API functions and their namespaces, and removes the need to pass the client and server classes when actually building clients and servers.

The README.md was effectively entirely rewritten based on these new patterns and conventions.

# v0.5 and below

- API-definition-based parsing with a lot of explicit passing of Client and Server classes
