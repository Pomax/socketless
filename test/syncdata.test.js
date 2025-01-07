import { assert } from "chai";
import { linkClasses } from "../src/index.js";
import {
  getBytesSent,
  resetBytesSent,
  toggleForcedSync,
  toggleTestFunctions,
} from "../src/upgraded-socket.js";

toggleTestFunctions(true);

describe("basic tests", () => {
  const runtimeMetrics = {
    forced: 0,
    diff: 0,
  };

  [true, false].forEach((forced) => {
    it(`verify that the silo sync function can be called (forced=${forced})`, (done) => {
      let error = `silo was not updated`;

      class ClientClass {
        onSyncUpdate(data, forced) {
          error = undefined;
        }
        endTest() {
          const bytes = getBytesSent();
          runtimeMetrics[forced ? `forced` : `diff`] = bytes;
          this.disconnect();
        }
      }

      class ServerClass {
        async onConnect(client) {
          const players = [
            { id: `da2c55c8-7e48-4cf7-8ac1-e09635bba536` },
            { id: `992dc1f0-db6a-4f7d-88e0-f9e1945f2afa` },
            { id: `51ad8d81-2033-4306-86b1-07640c4639ac` },
            { id: `fb2e390a-484d-454e-a46a-13ac103167f4` },
          ];
          const game = {
            players: [],
            currentHand: undefined,
          };
          const data = { players, game };
          await client.syncData(data);

          game.players[0] = players[0];
          await client.syncData(data);

          game.players[1] = players[1];
          await client.syncData(data);

          game.players[2] = players[2];
          await client.syncData(data);

          game.players[3] = players[3];
          await client.syncData(data);

          players[0].name = "test1";
          players[1].name = "test2";
          players[2].name = "test3";
          players[3].name = "test4";
          await client.syncData(data);

          players[0].tiles = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
          players[1].tiles = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
          players[2].tiles = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
          players[3].tiles = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
          game.currentHand = {
            players,
            wind: 0,
          };
          await client.syncData(data);

          for (let i = 0; i < 4; i++) {
            game.currentHand.players[i].tiles = [
              1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
            ];
            game.currentHand.players[i].latest = 14;
            await client.syncData(data);

            game.currentHand.players[i].tiles = [
              1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
            ];
            game.currentHand.players[i].latest = undefined;
            await client.syncData(data);
          }

          client.endTest();
        }
        async onDisconnect() {
          if (this.clients.length === 0) {
            this.quit();
          }
        }
        teardown() {
          done(error);
        }
      }

      toggleForcedSync(forced);
      resetBytesSent();

      const factory = linkClasses(ClientClass, ServerClass);
      const { webServer } = factory.createServer();
      webServer.listen(0, () => {
        factory.createClient(`http://localhost:${webServer.address().port}`);
      });
    });
  });

  it("confirm diffs are smaller than full updates", () => {
    const { forced, diff } = runtimeMetrics;
    assert(forced > diff, `force updates use more bytes than diffs`);
  });
});
