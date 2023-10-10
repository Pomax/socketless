import { join } from "path";

export function sanitizeLocation(location, publicDir) {
  // special handling for /
  if (location === `/`) return join(publicDir, `index.html`);

  // everything else is a static asset and we sanitize it.
  location = location.substring(1);
  location = location.replace(/\.\./g, ``).replace(/\/\//g, `/`);
  location = join(publicDir, location);

  return location;
}
