import { setDEBUG } from "./src/logger.js";
setDEBUG(false);

import { ClientClass, ServerClass } from "./custom-classes.js";
import { generateClientServer } from "./src/factory.js";
const factory = generateClientServer(ClientClass, ServerClass);
const server = factory.createServer();

server.listen(0, () => {
  const PORT = server.address().port;
  const url = `http://localhost:${PORT}`;
  console.log(`test server running on ${url}`);
  // for (let i = 0; i < 4; i++)
  factory.createClient(url);
});
