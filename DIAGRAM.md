Diagram:

### basic
```
server (webserver) ← (browser)
  ⇑
  ╚⇒ client
```

### web

```
server (webserver) ←───────┐
  ⇑                        │
  ╚⇒ client (webserver) ←┐ │
        ⇑                │ │
        ║                │ │
        ╚═⇒  browser ────┴─┘
```

- The server accepts client connections
- If clients are of the "WebClient" type, they themselves accept connections from the browser
