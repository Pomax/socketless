/**
 * ...docs go here...
 */
export class ClientClass {
  test = {
    something: () => {
      console.log(`- client: running this.test.something()`);
    },
  };

  async onConnect() {
    console.log(`- client ${this.state.id} is connected to server`);
    try {
      await this.server.testExceptionWhenCalledFromClient();
    } catch (e) {
      console.error(`- client received error:`, e.message);
      console.trace();
    }
    const result = await this.server.testFromClient(100, "this is a test");
    console.log(`- result of this.server.testFromClient():`, result);
  }

  async testExceptionWhenCalledFromServer() {
    throw new Error(
      "client throwing error for testExceptionWhenCalledFromServer()"
    );
  }

  async testFromServer(msg) {
    try {
      await this.server.does.not.exist();
    } catch (e) {
      console.error(`- client received error:`, e.message);
      console.trace();
    }
    console.log(`- test triggered on client by server:`, msg);
    this.disconnect();
  }
}

/**
 * ...docs go here...
 */
export class ServerClass {
  async onConnect(client) {
    console.log(`- server is connected to client ${client.id}`);
    console.log(
      `- client.test.something responded with:`,
      await client.test.something()
    );
    try {
      await client.testExceptionWhenCalledFromServer();
    } catch (e) {
      console.error(`- server received error:`, e.message);
      console.trace();
    }
  }

  async onDisconnect(client) {
    if (this.clients.length === 0) {
      console.log(`- no more clients connected, exiting`);
      this.quit();
    }
  }

  async testExceptionWhenCalledFromClient(client) {
    throw new Error(
      "server throwing error for testExceptionWhenCalledFromClient()"
    );
  }

  async testFromClient(client, v1, v2) {
    console.log(`- test triggered on server by client, v1=${v1}, v2=${v2}`);
    setTimeout(() => client.testFromServer("confirm"), 100);
    return [v1, v2];
  }
}
