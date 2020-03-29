class ClientClass {
  constructor() {
    log("created");
  }

  onConnect() {
    log("connected to server");
  }

  async "admin:setId"(id) {
    this.state.id = id;
    log(`setting id to ${id}`);
  }

  async "game:list"({ games }) {
    this.state.gameList = games;
  }

  async "game:start"({ startingPlayer, gameId, board }) {
    this.state.activeGame = {
      gameId,
      currentPlayer: startingPlayer,
      board: board
    };
  }

  async "game:played"({ gameId, currentPlayer, board }) {
    const game = this.state.activeGame;
    if (game.gameId === gameId) {
      game.currentPlayer = currentPlayer;
      game.board = board;
    }
  }

  async "game:won"({ gameId, winner }) {
    const game = this.state.activeGame;
    if (game.gameId === gameId) {
      game.winner = winner;
    }
  }

  async "game:draw"({ gameId }) {
    const game = this.state.activeGame;
    if (game.gameId === gameId) {
      game.draw = true;
    }
  }
}

module.exports = ClientClass;

function log(...data) {
  console.log("client>", ...data);
}
