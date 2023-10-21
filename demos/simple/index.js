const NUMBER_OF_CLIENTS = 4;

import { ClientClass } from "./ClientClass.js";
import { ServerClass } from "./ServerClass.js";
import { linkClasses } from "socketless";

const factory = linkClasses(ClientClass, ServerClass);
const { webserver } = factory.createServer();

webserver.listen(0, () => {
  const serverURL = `http://localhost:${webserver.address().port}`;
  [...new Array(NUMBER_OF_CLIENTS)].forEach(() =>
    factory.createClient(serverURL),
  );
});
