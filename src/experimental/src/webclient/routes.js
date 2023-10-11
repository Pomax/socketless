// @ts-ignore: Node-specific import
import fs from "fs";
import { getContentType } from "./get-content-type.js";
import { sanitizeLocation } from "./sanitize-location.js";
import { generate404 } from "./404.js";
import { generateSocketless } from "./generate-socketless.js";

// Create a route handler for our local web server
export function makeRouteHandler(publicDir, customRouter) {
  const socketlessjs = generateSocketless();

  return (request, response) => {
    if (request.url.includes(`?`)) {
      const [url, params] = request.url.split(/\\?\?/);
      request.url = url;
      request.params = new URLSearchParams(params);
    }

    const url = request.url;

    // this should never have been default behaviour
    if (url === `/favicon.ico`) {
      response.writeHead(200, { "Content-Type": `text/plain` });
      return response.end(``, `utf-8`);
    }

    // special handling for socketless.js
    if (url === `/socketless.js`) {
      response.writeHead(200, { "Content-Type": getContentType(`.js`) });
      return response.end(socketlessjs, `utf-8`);
    }

    // custom route handing
    if (customRouter.handle(url, request, response)) return;

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
