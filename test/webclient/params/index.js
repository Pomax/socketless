import { createBrowserClient } from "./socketless.js";
import { targets } from "./targets.js";

function compare(name, v1, v2) {
  const t1 = typeof v1;
  const t2 = typeof v2;
  if (t1 !== t2) {
    return `type mismatch: ${t1} !== ${t2}`;
  } else if (name === `object`) {
    if (JSON.stringify(v1) !== JSON.stringify(v2)) {
      return `mismatch in object`;
    }
  } else if (v1 !== v2) {
    return `value mismatch (${JSON.stringify(v1)} !== ${JSON.stringify(v2)})`;
  }
}

class BrowserClient {
  async init() {
    if (!this.params) {
      return this.server.fail(`no params found`);
    }

    for (const [name, value] of Object.entries(targets)) {
      if (this.params[name] === undefined) {
        return this.server.fail(`browser did not receive param "${name}"`);
      }

      const err = compare(name, this.params[name], value);

      if (err) {
        return this.server.fail(`error for param "${name}": ${err}`);
      }
    }

    this.server.pass();
  }
}

createBrowserClient(BrowserClient);
