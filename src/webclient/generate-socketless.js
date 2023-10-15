import { CLIENT, WEBCLIENT, BROWSER } from "../sources.js";

// @ts-ignore: Node-specific import
import fs from "fs";
// @ts-ignore: Node-specific import
import path from "path";
// @ts-ignore: Node-specific import
import url from "url";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

export function generateSocketless() {
  // Loop in the socket upgrade code, with tactical ESM replacements
  const upgradeSocket = fs
    .readFileSync(path.join(__dirname, `../upgraded-socket.js`))
    .toString(`utf-8`)
    // browsers have WebSocket built in
    .replace(`import { WebSocket } from "ws";`, ``)
    // and we don't need this import:
    .replace(
      `import { CLIENT, BROWSER } from "./sources.js";`,
      `const BROWSER = "${BROWSER}";\nconst CLIENT = "${CLIENT}";`,
    )
    // And we can't export inside of another export of course.
    .replaceAll(`export function`, `function`);

  // Then inject the actual "socketless" export...
  const socketless = `
    export function createWebClient(WebClientClass) {
      const socket = new WebSocket(window.location.toString().replace("http", "ws"));
      const browserClient = new WebClientClass();
      Object.defineProperty(browserClient, "socket", {
        value: socket,
        writable: false,
        configurable: false,
        enumerable: false
      });
      Object.defineProperty(browserClient, "server", {
        value: proxySocket("${BROWSER}", "${WEBCLIENT}", browserClient, socket),
        writable: false,
        configurable: false,
        enumerable: false
      });
      Object.defineProperty(browserClient, "quit", {
        value: () => browserClient.server.disconnect()
      });
      browserClient.state = {};
      browserClient.init();
      return browserClient;
    };
  `;

  // And include a full copy of the rfc6902 patch/diff/apply library.
  // This is non-optional and not so much "a build step" as simply
  // "we know where it lives, add it".
  const rfc6902 = fs
    .readFileSync(
      path.join(__dirname, `../../node_modules/rfc6902/dist/rfc6902.min.js`),
    )
    .toString(`utf-8`);

  return [upgradeSocket, socketless, rfc6902].join(`\n`);
}
