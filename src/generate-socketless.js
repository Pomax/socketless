/**
 * This script creates a browser library that gets served up
 * by the webclient's route-handler when the browser asks for
 * <script src="socketless.js" type="module" async>
 *
 * The "npm run compile" job runs this code and pipes it into
 * ./src/webclient/socketless.js, as a module that exports a
 * string constant.
 *
 * Which is base64 encoded because quoting a string with
 * quotes is a very special kind of headache.
 */

// @ts-ignore: Node-specific import
import fs from "fs";
// @ts-ignore: Node-specific import
import path from "path";
// @ts-ignore: Node-specific import
import url from "url";
const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

import { CLIENT, WEBCLIENT, BROWSER, deepCopy } from "./utils.js";
import { createSocketProxy } from "./upgraded-socket.js";

export function generateSocketless() {
  // ===============================================================
  // Loop in the socket upgrade code, with tactical ESM replacements
  // ===============================================================

  const upgradeSocket = fs
    .readFileSync(path.join(__dirname, `./upgraded-socket.js`))
    .toString(`utf-8`)
    // browsers have WebSocket built in
    .replace(`import { WebSocket } from "ws";`, ``)
    // and we don't need this import:
    .replace(
      `import { CLIENT, BROWSER, deepCopy } from "./utils.js";`,
      `const BROWSER = "${BROWSER}";\nconst CLIENT = "${CLIENT}";\nconst deepCopy = ${deepCopy.toString()}`,
    );

  // ===============================================================
  //         Then inject the actual "socketless" export
  // ===============================================================
  const socketless =
    `export ` +
    function createBrowserClient(BrowserClientClass) {
      const propertyConfig = {
        writable: false,
        configurable: false,
        enumerable: false,
      };
      const browserClient = new BrowserClientClass();

      const buildSocket = () => {
        return new WebSocket(window.location.toString().replace("http", "ws"));
      };

      let socket = buildSocket();

      const buildProxyServer = () => {
        return createSocketProxy("BROWSER", "WEBCLIENT", browserClient, socket);
      };

      let proxyServer = buildProxyServer();

      // create the web socket connection - note that if there are any query arguments,
      // those will get passed into the websocket upgrade request, too.
      Object.defineProperty(browserClient, "socket", {
        ...propertyConfig,
        value: socket,
      });

      // convenience function to "gracefully" disconnect from a web client:
      Object.defineProperty(browserClient, "disconnect", {
        ...propertyConfig,
        value: () => {
          browserClient.connected = false;
          socket.close();
          socket = undefined;
          proxyServer = undefined;
        },
      });

      // convenience function to reconnect to the web client:
      Object.defineProperty(browserClient, "reconnect", {
        ...propertyConfig,
        value: () => {
          socket = buildSocket();
          proxyServer = buildProxyServer();
          browserClient.connected = true;
        },
      });

      // create a proxy for the (webclient tunnel to the) server:
      Object.defineProperty(browserClient, "server", {
        ...propertyConfig,
        value: proxyServer,
      });

      browserClient.connected = true;
      browserClient.state = {};
      browserClient.init?.();
      return browserClient;
    }
      .toString()
      .replace(`BROWSER`, BROWSER)
      .replace(`WEBCLIENT`, WEBCLIENT);

  // ===============================================================
  // And include a full copy of the rfc6902 patch/diff/apply library.
  // This is non-optional and not so much "a build step" as simply
  // "we know where it lives, add it".
  //
  // Although we do need to make sure we check whether socketless is
  // being used as a module, or whether someone's just working in
  // the socketless project itself, because that changes where
  // other modules can be found.
  // ===============================================================

  const rfc6902Path = path.join(
    __dirname,
    __dirname.includes(`node_modules`) ? `../../..` : `..`,
    `node_modules/rfc6902/dist/rfc6902.min.js`,
  );
  const rfc6902 = fs.readFileSync(rfc6902Path).toString(`utf-8`);

  return [upgradeSocket, socketless, rfc6902].join(`\n`);
}
