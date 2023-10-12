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

const NUMBER_OF_CLIENTS = 4;

/**
 * ...
 */
const server = factory.createServer();
server.listen(8000, () => {
  [...new Array(NUMBER_OF_CLIENTS)].forEach(() =>
    factory.createClient("http://localhost:8000"),
  );
});
