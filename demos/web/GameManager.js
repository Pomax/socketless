import { Game } from "./Game.js";

export class GameManager {
  constructor() {
    this.games = {};
    this.idCounter = 1;
    this.gameIds = {};
  }

  getList(client) {
    return Object.values(this.games).map((game) => game.getSummary(client));
  }

  digest(id) {
    let digest = this.gameIds[id];
    if (!digest) {
      digest = this.gameIds[id] = this.idCounter++;
    }
    return digest;
  }

  create(client) {
    let gameId = this.gameIds[client.id];
    if (!gameId) gameId = this.gameIds[client.id] = this.idCounter++;
    this.games[gameId] = new Game(gameId);
    this.join(gameId, client);
  }

  join(gameId, client) {
    const game = this.games[gameId];
    if (!game) throw new Error(`no such game id:${gameId}`);
    game.join(client);
  }

  play(gameId, clientId, position) {
    const game = this.games[gameId];
    if (!game) throw new Error(`no such game id:${gameId}`);
    game.play(clientId, position);
  }
}
