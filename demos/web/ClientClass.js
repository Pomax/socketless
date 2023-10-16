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
        this.setState({ gameList: games });
      },
      start: (gameId, startingPlayer, board) => {
        this.setState({
          activeGame: {
            gameId,
            currentPlayer: startingPlayer,
            board: board,
          },
        });
      },
      played: (gameId, currentPlayer, board) => {
        const game = this.state.activeGame;
        if (game.gameId === gameId) {
          game.currentPlayer = currentPlayer;
          game.board = board;
        }
      },
      draw: (gameId) => {
        const game = this.state.activeGame;
        if (game.gameId === gameId) {
          game.draw = true;
        }
      },
      won: (gameId, winner) => {
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
