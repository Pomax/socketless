import { ClientBase, ServerBase } from "./classes.js";
import { generateClientServer } from "./factory.js";

class ClientClass extends ClientBase {
  constructor(...args) {
    super(...args);
    this.test = {
      something: () => console.log(`something test`)
    }
  }
  async onConnect() {
    console.log(`client is connected to server`);
    const result = await this.server.testFromClient(100, "this is a test");
    console.log(`result of this.server.testFromClient():`, result);
  }
  testFromServer(msg) {
    console.log(`test triggered on client by server:`, msg);
    this.disconnect();
  }
}

class ServerClass extends ServerBase {
  async onConnect(client) {
    console.log(`server is connected to client`);
    console.log(await client.test.something());
  }
  async onDisconnect(client) {
    if (this.clients.length === 0) {
      this.quit();
    }
  }
  testFromClient(client, v1, v2) {
    console.log(`test triggered on server by client, v1=${v1}, v2=${v2}`);
    setTimeout(() => client.testFromServer("confirm"), 100);
    return [v1, v2];
  }
}

const factory = generateClientServer(ClientClass, ServerClass);
const server = factory.createServer();

server.listen(0, () => {
  console.log(`running...`);
  const PORT = server.address().port;
  const client = factory.createClient(`http://localhost:${PORT}`);
});
