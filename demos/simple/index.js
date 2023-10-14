const NUMBER_OF_CLIENTS = 4;

import { generateClientServer } from "socketless";
import { ClientClass } from "./ClientClass.js";
import { ServerClass } from "./ServerClass.js";

const factory = generateClientServer(ClientClass, ServerClass);
const server = factory.createServer();

server.listen(0, () => {
  const serverURL = `http://localhost:${server.address().port}`;
  [...new Array(NUMBER_OF_CLIENTS)].forEach(() =>
    factory.createClient(serverURL)
  );
});
