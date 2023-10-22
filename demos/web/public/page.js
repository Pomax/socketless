import { BrowserClientClass } from "./ui.js";
import(`./socketless.js${location.search}`).then((lib) => {
  const { createBrowserClient } = lib;
  createBrowserClient(BrowserClientClass);
});
