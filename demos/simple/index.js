const NUMBER_OF_CLIENTS = 4;

import { ClientClass } from "./ClientClass.js";
import { ServerClass } from "./ServerClass.js";
import { linkClasses } from "socketless";

const factory = linkClasses(ClientClass, ServerClass);
const { webServer } = factory.createServer();

webServer.listen(0, () => {
  const serverURL = `http://localhost:${webServer.address().port}`;
  [...new Array(NUMBER_OF_CLIENTS)].forEach(() =>
    factory.createClient(serverURL),
  );
});
