/**
 * ...
 */
import { ClientClass } from "./ClientClass.js";
import { ServerClass } from "./ServerClass.js";

/**
 * ...
 */
import { generateClientServer } from "socketless";
const factory = generateClientServer(ClientClass, ServerClass);

/**
 * ...
 */
const server = factory.createServer();
server.listen(8000, () => {
  [...new Array(4)].forEach(() =>
    factory.createClient("http://localhost:8000"),
  );
});
