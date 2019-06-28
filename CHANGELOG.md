# v0.7.0

This adds explicit API objects back in, but as optional third argument to `generateClientServer`. It also adds in broadcasting by clients, based on clients knowing their own API and so knowing which function they want to have triggered by a broadcast.

(Server broadcasting is simply calling `this.clients.forEach(c => c.namespace.fname(...)`)   

# v0.6.0

This version changes the way you use the library, removing the need for a separate API object at the cost of having to namespace all your functions in your client and server classes. The `generateClientServer` function can no be called with an API object, and must be called as `generateClientServer(ClientClass, ServerClass)` instead. This will perform auto-discovery of all the API functions and their namespaces, and removes the need to pass the client and server classes when actually building clients and servers.

The README.md was effectively entirely rewritten based on these new patterns and conventions.

# v0.5 and below

- API-definition-based parsing with a lot of explicit passing of Client and Server classes
