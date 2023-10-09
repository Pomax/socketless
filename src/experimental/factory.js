// @ts-ignore: Node-specific import
import http from "http";
// @ts-ignore: Node-specific import
import https from "https";

import { WebSocket, WebSocketServer } from "ws";

export function generateClientServer(ClientClass, ServerClass) {
  return {
    createServer: function createServer(httpsOptions = false) {
      const webserver = httpsOptions ? https.createServer(httpsOptions) : http.createServer();
      const ws = new WebSocketServer({ server: webserver });
      const server = new ServerClass({ webserver, ws });
      ws.on(`connection`, function (socket) {
        console.log(`client.connectClientSocket`)
        server.connectClientSocket(socket);
      });
      return webserver;
    },
    createClient: function createClient(serverURL) {
      const socketToServer = new WebSocket(serverURL);
      const client = new ClientClass();
      socketToServer.on(`close`, (...data) => client.onDisconnect(...data));
      socketToServer.on(`open`, (...data) => client.connectServerSocket(socketToServer, ...data));
      return client;
    },
    createWebClient: function createWebClient(serverUrl, publicDir, httpsOptions) {
      const client = this.createClient(serverUrl);
      const webserver = httpsOptions ? https.createServer(httpsOptions) : http.createServer();
      
      // this webserver must serve content from the indicated `public` directory
      // and must have a special "socketless.js" route handler that will serve a browser-specific
      // library that routes "this.server.blah()" calls through the `client`, and proxies
      // responses back to the browser.

      // see create-web-client.js

      return webserver;
    }
  }
};
