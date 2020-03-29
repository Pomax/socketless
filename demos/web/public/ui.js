class WebClient {
  constructor() {
    this.gameList = document.getElementById("gamelist");

    let create = document.getElementById("create");
    create.addEventListener(`click`, evt => {
      this.server.game.create();
    });

    let quit = document.getElementById("quit");
    quit.addEventListener(`click`, evt => {
      this.quit();
    });
  }

  update(state) {
    let list = this.gameList;
    list.innerHTML = ``;
    state.gameList.forEach(entry => {
      const { id, owner, waiting, started } = entry;
      const li = document.createElement(`li`);
      li.textContent = id;
      list.appendChild(li);

      if (waiting) {
        if (!owner) {
          const join = document.createElement(`button`);
          join.textContent = `join`;
          join.addEventListener(`click`, evt => {
            this.server.game.join({ gameId: id });
          });
          li.appendChild(join);
        } else {
          li.textContent = `${li.textContent} (waiting)`;
        }
      } else if (owner && !started) {
        const start = document.createElement(`button`);
        start.textContent = `start`;
        start.addEventListener(`click`, evt => {
          this.server.game.start({ gameId: id });
        });
        li.appendChild(start);
      }
    });

    const game = state.activeGame;
    if (game) this.drawBoard(game);
  }

  drawBoard(game) {
    const { gameId, currentPlayer, board, winner, draw } = game;
    const ourTurn = currentPlayer === this.state.id;
    const gameBoard = document.getElementById("board");
    gameBoard.innerHTML = ``;

    if (ourTurn) {
      gameBoard.classList.add("ourturn");
    } else {
      gameBoard.classList.remove("ourturn");
    }

    if (winner) {
      gameBoard.classList.add(
        "over",
        this.state.id === winner ? "winner" : "loser"
      );
    } else if (draw) {
      gameBoard.classList.add("over", "draw");
    } else {
      gameBoard.classList.remove("over", "winner", "loser");
    }

    if (winner) {
      gameBoard.classList.add("winner");
    } else {
      gameBoard.classList.remove("winner");
    }

    board.split(`,`).forEach((value, position) => {
      const space = document.createElement("div");
      space.classList.add("space");
      space.textContent = value;
      if (!winner && !value && ourTurn) {
        space.addEventListener("click", evt => {
          this.server.game.play({ gameId, position });
        });
      }
      gameBoard.appendChild(space);
    });
  }
}

export { WebClient };
