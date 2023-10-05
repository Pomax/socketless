import { join } from "path";

export function sanitizeLocation(location, projectDir, webRootDir) {
  // special handling for /
  if (location === `/`) return join(webRootDir, `index.html`);

  // everything else is a static asset and we sanitize it.
  location = location.substring(1);
  location = location.replace(/\.\./g, ``).replace(/\/\//g, `/`);
  location = join(webRootDir, location);

  return location;
}
