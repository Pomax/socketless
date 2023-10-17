export class CustomRouter {
  /**
   * Bootstrap the custom router with a reference to the
   * webclient's underlying client instance, so that code
   * in a route handler can directly call (non-socketless)
   * functions on the client instance if needed.
   */
  constructor(owner) {
    this.owner = owner;
    this.routes = {};
  }

  /**
   * Add a route handler, using the url as lookup key.
   */
  addRouteHandler(url, ...handlers) {
    this.routes[url] = handlers;
  }

  /**
   * Return false if no route for the specified URL can
   * be found. Otherwise, run the route handler, and then
   * return true, to signal the route got handled.
   */
  async handle(url, req, res) {
    const chain = this.routes[url];
    if (!chain) return false;

    for (let i = 0, e = chain.length; i < e; i++) {
      const route = chain[i];
      let halt = true;
      const next = () => (halt = false);
      try {
        await route(req, res, next);
      } catch (e) {
        console.error(e);
        console.trace();
        break;
      }
      if (halt) break;
    }
    return true;
  }
}
