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
