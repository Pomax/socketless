/**
 * This module is a convenience module for accessing all
 * the various build functions under a single namespace.
 */

// generators for call routing at the client and server.
export { createClientCallHandler } from "./server/client-call-handler.js";
export { createServerCallHandler } from "./client/server-call-handler.js";

// generators for the proxy represenations of the client at the server, and the server at the client.
export { createClientProxyAtServer } from "./server/client-proxy-at-server.js";
export { createServerProxyAtClient } from "./client/server-proxy-at-client.js";

// factory functions for the client and server proxies.
export { createClientProxy } from "./server/create-client-proxy.js";
export { createServerProxy } from "./client/create-server-proxy.js";

// factory functions for the actual websocket client/server.
export { createClient } from "./client/create-client.js";
export { createWebClient } from "./webclient/create-web-client.js";
export { createServer } from "./server/create-server.js";
