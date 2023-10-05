// A silly match three game implementation
export class Game {
  constructor(gameId) {
    this.id = gameId;
    this.players = [];
    this.board = [...new Array(9)];
    this.movesLeft = 9;
  }

  join(client) {
    if (this.players.length == 2) throw new Error("game full");
    this.players.push(client);
    if (this.players.length == 2) this.start();
  }

  start() {
    this.activePlayer = this.players[(Math.random() * 2) | 0].id;
    this.players.forEach((client) =>
      client.game.start({
        gameId: this.id,
        startingPlayer: this.activePlayer,
        board: this.board.join(`,`),
      }),
    );
  }

  play(clientId, position) {
    // lots of "is this a legal move" checks first:
    if (!this.activePlayer) throw new Error("game not started");
    if (clientId !== this.activePlayer) throw new Error("out of turn");
    if (this.won) throw new Error("game finished");
    if (position < 0 || position > 8) throw new Error("illegal move");
    const pid = this.players.findIndex((client) => client.id === clientId);
    if (this.board[position]) throw new Error("move was already played");
    // IF we're all good: mark the play and inform all players.
    this.playMove(pid, position);
  }

  playMove(pid, position) {
    this.board[position] = pid + 1;
    this.movesLeft--;
    const board = this.board.join(`,`);
    const currentPlayer = (this.activePlayer = this.players[pid ^ 1].id); // flip between player 0 and 1 using xor
    this.players.forEach((client) =>
      client.game.played({
        gameId: this.id,
        currentPlayer,
        board,
      }),
    );

    this.checkGameOver(pid, position);
  }

  checkGameOver(pid, position) {
    // can't have a game-over until player 0 has at least three tiles claimed
    if (this.movesLeft > 4) return;

    // Do we have a draw?
    if (this.movesLeft === 0) {
      return this.players.forEach((client) =>
        client.game.draw({
          gameId: this.id,
        }),
      );
    }

    // If not, do we have a winner?
    const gameWon = this.checkWinner(this.board, position);
    if (gameWon) {
      const winner = this.players[pid].id;
      this.players.forEach((client) =>
        client.game.won({
          gameId: this.id,
          winner,
        }),
      );
    }
  }

  checkWinner(b, position) {
    switch (position) {
      // we don't need to check the whole board, we only need to check if the new play completes a triplet.
      case 0:
        return (
          (b[0] === b[1] && b[1] === b[2]) ||
          (b[0] === b[3] && b[3] === b[6]) ||
          (b[0] === b[4] && b[4] === b[8])
        );
      case 1:
        return (
          (b[0] === b[1] && b[1] === b[2]) || (b[1] === b[4] && b[4] === b[7])
        );
      case 2:
        return (
          (b[0] === b[1] && b[1] === b[2]) ||
          (b[2] === b[5] && b[5] === b[8]) ||
          (b[2] === b[4] && b[4] === b[6])
        );
      case 3:
        return (
          (b[3] === b[4] && b[4] === b[5]) || (b[0] === b[3] && b[3] === b[6])
        );
      case 4:
        return (
          (b[3] === b[4] && b[4] === b[5]) ||
          (b[1] === b[4] && b[4] === b[7]) ||
          (b[0] === b[4] && b[4] === b[8]) ||
          (b[2] === b[4] && b[4] === b[6])
        );
      case 5:
        return (
          (b[3] === b[4] && b[4] === b[5]) || (b[2] === b[5] && b[5] === b[8])
        );
      case 6:
        return (
          (b[6] === b[7] && b[7] === b[8]) ||
          (b[0] === b[3] && b[3] === b[6]) ||
          (b[2] === b[4] && b[4] === b[6])
        );
      case 7:
        return (
          (b[6] === b[7] && b[7] === b[8]) || (b[1] === b[4] && b[4] === b[7])
        );
      case 8:
        return (
          (b[6] === b[7] && b[7] === b[8]) ||
          (b[2] === b[5] && b[5] === b[8]) ||
          (b[0] === b[4] && b[4] === b[8])
        );
      default:
        return false;
    }
  }

  getSummary(client) {
    return {
      id: this.id,
      owner: this.players[0] === client,
      waiting: this.players.length < 2,
      started: !!this.activePlayer,
    };
  }
}
