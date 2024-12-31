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
      const lockObject = (input) => {
        Object.keys(input).forEach((key) => {
          if (typeof input[key] === "object" && !Object.isFrozen(input[key]))
            lockObject(input[key]);
        });
        return Object.freeze(input);
      };

      const propertyConfig = {
        writable: false,
        configurable: false,
        enumerable: false,
      };
      const browserClient = new BrowserClientClass();

      const buildSocket = () => {
        return new WebSocket(window.location.toString().replace(`http`, `ws`));
      };

      let socket = buildSocket();

      const buildProxyServer = () => {
        return createSocketProxy(`BROWSER`, `WEBCLIENT`, browserClient, socket);
      };

      let proxyServer = buildProxyServer();

      // create the web socket connection - note that if there are any query arguments,
      // those will get passed into the websocket upgrade request, too.
      Object.defineProperty(browserClient, `socket`, {
        ...propertyConfig,
        value: socket,
      });

      // convenience function to "gracefully" disconnect from a web client:
      Object.defineProperty(browserClient, `disconnect`, {
        ...propertyConfig,
        value: () => {
          browserClient.connected = false;
          socket.close();
          socket = undefined;
          proxyServer = undefined;
        },
      });

      // convenience function to reconnect to the web client:
      Object.defineProperty(browserClient, `reconnect`, {
        ...propertyConfig,
        value: () => {
          socket = buildSocket();
          proxyServer = buildProxyServer();
          browserClient.connected = true;
        },
      });

      // create a proxy for the (webclient tunnel to the) server:
      Object.defineProperty(browserClient, `server`, {
        ...propertyConfig,
        value: proxyServer,
      });

      // create a proxy for the (webclient tunnel to the) server:
      Object.defineProperty(browserClient, `quit`, {
        ...propertyConfig,
        value: () => {
          // @ts-ignore to prevent "Property quit does not exist on type SocketProxy" errors
          proxyServer.quit();
        },
      });

      // make the .state property immutable
      Object.defineProperty(browserClient, `state`, {
        get: () => browserClient.__state_backing,
        set: () => {
          throw new Error(`state is a protected value.`);
        },
      });

      // make the .state property immutable
      Object.defineProperty(browserClient, `getStateCopy`, {
        ...propertyConfig,
        value: () => structuredClone(browserClient.__state_backing),
      });

      // parse any query params to the type they should most
      // like be, based on JSON parsing rules:
      const params = Object.fromEntries(
        location.search
          .replace(/^\?/, ``)
          .split(`&`)
          .map((s) => {
            let [key, value] = s.split(`=`);
            try {
              value = JSON.parse(decodeURIComponent(value));
            } catch (e) {}
            return [key, value];
          }),
      );

      // then expose those as a read-only `this.params`
      Object.defineProperty(browserClient, `params`, {
        configurable: false,
        get: () => params,
        set: () => {},
      });

      // TODO: is there a way we can refactor this so we're not
      //       duplicating the changeflag code from upgraded-socket?
      function getChangeFlags(initialState) {
        // @ts-ignore
        const diff = rfc6902.createPatch({}, initialState);
        const changeFlags = {};
        diff.forEach(({ path, value }) => {
          let lvl = changeFlags;
          const parts = path.split(`/`);
          parts.shift(); // path starts with a leading slash
          if (parts.at(-1) === `-`) parts.pop(); // is this an array push?
          while (parts.length > 1) {
            const part = parts.shift();
            lvl = lvl[part] ??= {};
          }
          if (typeof value === `object`) {
            lvl[parts[0]] = JSON.parse(
              JSON.stringify(value, (k, v) => {
                if (typeof v !== `object` || v instanceof Array) return true;
                return v;
              }),
            );
          } else {
            lvl[parts[0]] = true;
          }
        });
        return changeFlags;
      }

      // Don't call init() until we're properly connected
      // and know the current client state.
      socket.onopen = async () => {
        browserClient.connected = true;
        // @ts-ignore to prevent "Property syncState does not exist on type SocketProxy" errors
        browserClient.__state_backing = (await proxyServer.syncState()) || {};
        lockObject(browserClient.__state_backing);
        browserClient.init?.();
        /* prettier-ignore */
        browserClient.update?.({}, getChangeFlags(browserClient.__state_backing));
      };

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
