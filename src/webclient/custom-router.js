export class CustomRouter {
  /**
   * Bootstrap the custom router with a reference to the
   * webclient's underlying client instance, so that code
   * in a route handler can directly call (non-socketless)
   * functions on the client instance if needed.
   */
  constructor(client) {
    this.client = client;
    this.routes = {};
  }

  /**
   * Add a route handler, using the url as lookup key.
   */
  addRouteHandler(url, handler) {
    this.routes[url] = handler;
  }

  /**
   * Return false if no route for the specified URL can
   * be found. Otherwise, run the route handler, and then
   * return true, to signal the route got handled.
   */
  handle(url, request, response) {
    const route = this.routes[url];
    if (!route) return false;
    route(this.client, request, response);
    return true;
  }
}
