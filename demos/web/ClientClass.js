export class ClientClass {
  constructor() {
    console.log(`web client created`);
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

  async onConnect() {
    console.log(`connected to server`);
  }

  async onBrowserConnect(browser) {
    const result = await browser?.showMessage(`We should be good to go.`);
    console.log(`browser.showMessage result: ${result}`);
  }
}
