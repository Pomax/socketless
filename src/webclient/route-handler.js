// @ts-ignore: Node-specific import
import fs from "node:fs";
// @ts-ignore: Node-specific import
import { join } from "node:path";

import { generateSocketless } from "../generate-socketless.js";

const DEBUG = false;

const CONTENT_TYPES = {
  ".html": `text/html`,
  ".css": `text/css`,
  ".js": `application/javascript`,
  ".jpg": `image/jpeg`,
  ".png": `image/png`,
};

const DEFAULT_CONTENT_TYPE = `text/plain`;

// ...docs go here...
function getContentType(location) {
  let key = Object.keys(CONTENT_TYPES).find(
    (key) => location.slice(-key.length) === key,
  );
  let contentType = CONTENT_TYPES[key] || DEFAULT_CONTENT_TYPE;
  return contentType;
}

// ...docs go here...
function sanitizeLocation(location, publicDir) {
  // special handling for /
  if (location === `/`) return join(publicDir, `index.html`);

  // everything else is a static asset and we sanitize it.
  location = location.substring(1);
  location = location.replaceAll(`../`, `/`).replace(/\/+/g, `/`);
  location = join(publicDir, location);
  return location;
}

// ...docs go here...
function generate404(location, response, reason = ``) {
  // We're going to assume any bad URL is a 404. Even if it's an attempt at "h4x0r3s"
  if (DEBUG)
    console.error(
      reason ?? `Can't serve ${location}, so it probably doesn't exist`,
    );
  response.writeHead(404, { "Content-Type": getContentType(`.html`) });
  response.end(`<doctype html><html><body>resource not found</body></html>`);
}

/**
 * Create a route handler for our local web server
 */
export function makeRouteHandler(client, publicDir, customRouter) {
  return async (request, response) => {
    request.params = {
      get: (_) => undefined,
    };

    if (request.url.includes(`?`)) {
      const [url, params] = request.url.split(/\\?\?/);
      request.url = url;
      request.params = new URLSearchParams(params);
    }

    const { url, params } = request;

    // this should never have been default behaviour
    if (url === `/favicon.ico`) {
      response.writeHead(200, { "Content-Type": `text/plain` });
      return response.end(``, `utf-8`);
    }

    // special handling for socketless.js
    if (url === `/socketless.js`) {
      const sid = client.params.get(`sid`);
      if (sid && params.get(`sid`) !== sid) {
        return generate404(
          `socketless.js`,
          response,
          `sid mismatch, not serving socketless.js`,
        );
      }
      response.writeHead(200, { "Content-Type": getContentType(`.js`) });
      return response.end(generateSocketless(), `utf-8`);
    }

    // custom route handing
    if (await customRouter.handle(url, request, response)) return;

    // convert the URL request into a file path
    var location = sanitizeLocation(request.url, publicDir);

    // Serve file or send a 404
    fs.readFile(location, (error, content) => {
      if (error) return generate404(location, response);
      response.writeHead(200, { "Content-Type": getContentType(location) });
      response.end(content, `utf-8`);
    });
  };
}
