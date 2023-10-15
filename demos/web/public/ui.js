class WebClient {
  init() {
    this.gameList = document.getElementById("gamelist");
    const create = document.getElementById("create");
    create.addEventListener(`click`, () => this.server.game.create());
    const quit = document.getElementById("quit");
    quit.addEventListener(`click`, () => {
      this.quit();
      document.body.textContent = `You can safely close this tab now.`;
    });
  }

  update(prevState) {
    const { state } = this;
    console.log(`update:`, prevState, state);
    const list = this.gameList;
    list.innerHTML = ``;
    state.gameList.forEach((entry) => {
      const { id, owner, waiting, started } = entry;
      const li = document.createElement(`li`);
      li.textContent = id;
      list.appendChild(li);

      if (waiting) {
        if (!owner) {
          const join = document.createElement(`button`);
          join.textContent = `join`;
          join.addEventListener(`click`, (evt) => {
            this.server.game.join({ gameId: id });
          });
          li.appendChild(join);
        } else {
          li.textContent = `${li.textContent} (waiting)`;
        }
      } else if (owner && !started) {
        const start = document.createElement(`button`);
        start.textContent = `start`;
        start.addEventListener(`click`, (evt) => {
          this.server.game.start({ gameId: id });
        });
        li.appendChild(start);
      }
    });

    const game = state.activeGame;
    console.log(`game:`, game);
    if (game) this.drawBoard(game);
  }

  drawBoard(game) {
    const { gameId, currentPlayer, board, winner, draw } = game;
    const ourTurn = currentPlayer === this.state.id;
    const gameBoard = document.getElementById("board");
    gameBoard.innerHTML = ``;

    const classes = gameBoard.classList;

    classes.toggle("ourturn", ourTurn);

    if (winner) {
      classes.add("over", this.state.id === winner ? "winner" : "loser");
    } else if (draw) {
      classes.add("over", "draw");
    } else {
      classes.remove("over", "winner", "loser");
    }

    board.split(`,`).forEach((value, position) => {
      const space = document.createElement("div");
      space.classList.add("space");
      space.textContent = value;
      if (!winner && !value && ourTurn) {
        space.addEventListener("click", (evt) => {
          this.server.game.play({ gameId, position });
        });
      }
      gameBoard.appendChild(space);
    });
  }
}

export { WebClient };
