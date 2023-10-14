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
    // And we can't export inside of another export of course.
    .replaceAll(`export function`, `function`);

  // Then inject the actual "socketless" export...
  const socketless = `
    export function createWebClient(WebClientClass) {
      const socket = new WebSocket(window.location.toString().replace("http", "ws"));
      const webclient = new WebClientClass();
      Object.defineProperty(webclient, "socket", {
        value: socket,
        writable: false,
        configurable: false,
        enumerable: false
      });
      Object.defineProperty(webclient, "server", {
        value: proxySocket("webclient", webclient, socket),
        writable: false,
        configurable: false,
        enumerable: false
      });
      webclient.state = {};
      webclient.init();
      return webclient;
    };
  `;

  // And include a full copy of the rfc6902 patch/diff/apply library.
  // This is non-optional and not so much "a build step" as simply
  // "we know where it lives, add it".
  const rfc6902 = fs
    .readFileSync(
      path.join(__dirname, `../../node_modules/rfc6902/dist/rfc6902.min.js`)
    )
    .toString(`utf-8`);

  return [upgradeSocket, socketless, rfc6902].join(`\n`);
}
