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

import { CLIENT, WEBCLIENT, BROWSER } from "./sources.js";

function generateSocketless() {
  // Loop in the socket upgrade code, with tactical ESM replacements
  const upgradeSocket = fs
    .readFileSync(path.join(__dirname, `./upgraded-socket.js`))
    .toString(`utf-8`)
    // browsers have WebSocket built in
    .replace(`import { WebSocket } from "ws";`, ``)
    // and we don't need this import:
    .replace(
      `import { CLIENT, BROWSER } from "./sources.js";`,
      `const BROWSER = "${BROWSER}";\nconst CLIENT = "${CLIENT}";`,
    );

  // Then inject the actual "socketless" export...
  const socketless = `export function createWebClient(WebClientClass) { const socket = new WebSocket(window.location.toString().replace("http", "ws")); const browserClient = new WebClientClass(); Object.defineProperty(browserClient, "socket", { value: socket, writable: false, configurable: false, enumerable: false }); Object.defineProperty(browserClient, "server", { value: proxySocket("${BROWSER}", "${WEBCLIENT}", browserClient, socket), writable: false, configurable: false, enumerable: false }); Object.defineProperty(browserClient, "quit", { value: () => browserClient.server.disconnect() }); browserClient.state = {}; browserClient.init(); return browserClient; };`;

  // And include a full copy of the rfc6902 patch/diff/apply library.
  // This is non-optional and not so much "a build step" as simply
  // "we know where it lives, add it".
  const rfc6902 = fs
    .readFileSync(
      path.join(__dirname, `../node_modules/rfc6902/dist/rfc6902.min.js`),
    )
    .toString(`utf-8`);

  return [upgradeSocket, socketless, rfc6902].join(`\n`);
}

// Export the "compiled" library as a string constant so it can be
// bundled into the final library.js file without quote conflicts.
if (typeof process !== `undefined`) {
  const socketlessjs = generateSocketless();
  const base64Encoded = Buffer.from(socketlessjs).toString("base64");
  console.log(`export const socketlessjs = atob("${base64Encoded}");`);
}
