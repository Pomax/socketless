export class ClientClass {
  constructor() {
    console.log(`created`);
    this.admin = {
      setId: (id) => {
        this.setState({ id });
        console.log(`setting id to ${id}`);
      },
    };
    this.game = {
      list: ({ games }) => {
        console.log(`ui: list`);
        this.setState({ gameList: games });
      },
      start: (gameId, startingPlayer, board) => {
        console.log(`ui: start`);
        this.setState({
          activeGame: {
            gameId,
            currentPlayer: startingPlayer,
            board: board,
          },
        });
      },
      played: (gameId, currentPlayer, board) => {
        console.log(`ui: played`);
        const game = this.state.activeGame;
        if (game.gameId === gameId) {
          game.currentPlayer = currentPlayer;
          game.board = board;
        }
      },
      draw: (gameId) => {
        console.log(`ui: draw`);
        const game = this.state.activeGame;
        if (game.gameId === gameId) {
          game.draw = true;
        }
      },
      won: (gameId, winner) => {
        console.log(`ui: won`);
        const game = this.state.activeGame;
        if (game.gameId === gameId) {
          game.winner = winner;
        }
      },
    };
  }

  onConnect() {
    console.log(`connected to server`);
  }
}
