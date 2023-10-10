// @ts-ignore: Node-specific import
import fs from "fs";
// @ts-ignore: Node-specific import
import path from "path";
// @ts-ignore: Node-specific import
import url from "url";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

export function generateSocketless() {
  const code = [
    // Loop in the socket upgrade code, with tactical ESM replacements
    fs
      .readFileSync(path.join(__dirname, `../upgraded-socket.js`))
      .toString(`utf-8`)
      // browsers have WebSocket built in
      .replace(`import { WebSocket } from "ws";`, ``)
      // And we can't export inside of another export of course.
      .replace(`export function`, `function`)
      // rewrite logger
      .replace(
        `import { log } from "./logger.js";`,
        `const log = (...args) => console.log(...args);`
      ),

    `\n`,

    `
export const Socketless = {
  createWebClient: (WebClientClass) => {
    const socket = new WebSocket(window.location.toString().replace("http:", "ws:"));
    const webclient = new WebClientClass();
    webclient.socket = socket;
    webclient.server = proxySocket("webclient", webclient, socket);
    webclient.state = {};
    webclient.init();
    return webclient;
  }
};`,

    `\n`,

    // And include a full copy of the rfc6902 patch/diff/apply library.
    // This is non-optional and not so much "a build step" as simply
    // "we know where it lives, add it".
    fs
      .readFileSync(
        path.join(
          __dirname,
          `../../../../node_modules/rfc6902/dist/rfc6902.min.js`
        )
      )
      .toString(`utf-8`),
  ].join(`\n`);

  return code;
}
