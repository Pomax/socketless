/**
 * The web client is effectively a thin client around
 * the real client - it receives state updates that ensure
 * that the browser is always in the same state as the
 * real client, and its main purpose is to make sure it
 * presents that state to the user in whatever fashion
 * makes the most sense (vue, react, vanilla JS with
 * template string HTML, whatever works for you).
 */
export default class WebClientClass {
  /**
   *  ...
   */
  constructor() {
    this.elements = {};
    [
      `gamelist`,
      `games`,
      `lobby`,
      `users`,
      `chat`,
      `tiles`,
      `playerinfo`,
      `discard`
    ].forEach(id => (this.elements[id] = document.getElementById(id)));
  }

  /**
   *  ...
   */
  async update() {
    this.updateGames();
    this.updateCurrentGame();
    this.updateDiscard();
    this.updateUserInfo();
    this.updateUsers();
  }

  /**
   *  ...
   */
  updateGames() {
    this.elements.games.innerHTML = ``;

    this.games.forEach(g => {
      let li = document.createElement(`li`);
      let label = g.id === this.id ? "start" : "join";
      li.innerHTML = `<a>${JSON.stringify(g)} <button>${label}</button></a>`;
      this.elements.games.appendChild(li);
      let join = li.querySelector("button");

      if (g.inProgress) join.disabled = true;
      else {
        let joinOrStart = async () => {
          // if we're not joined, join.
          this.server.game.join(g.name);

          // if we are, start the game.
          this.server.game.start(g.name);

          // these two operations are mutually exclusive,
          // because owner can't join, and non-owners
          // can't start a game.

          join.removeEventListener(`click`, joinOrStart);
          join.disabled = true;
        };

        join.addEventListener(`click`, joinOrStart);
      }
    });
  }

  /**
   *  ...
   */
  updateCurrentGame() {
    this.elements.tiles.innerHTML = ``;

    if (this.currentGame && this.tiles) {
      this.tiles.forEach(tilenumber => {
        let li = document.createElement(`li`);
        li.className = `tile`;
        li.dataset.tile = tilenumber;
        li.textContent = tilenumber;
        li.addEventListener("click", async () => {
          this.server.game.discardTile({
            gameName: this.currentGame,
            tilenumber
          });
        });
        this.elements.tiles.appendChild(li);
      });
    }
  }

  /**
   *  ...
   */
  updateDiscard() {
    this.elements.discard.innerHTML = ``;

    if (this.currentDiscard) {
      this.elements.discard.innerHTML = `Current discard: <span class="tile" data-tile="${this.currentDiscard.tilenumber}"></span>`;
    }
  }

  /**
   *  ...
   */
  updateUserInfo() {
    this.elements.playerinfo.innerHTML = ``;

    if (this.seat || this.wind) {
      this.elements.playerinfo.textContent = `seat: ${this.seat}, wind: ${this.wind}`;
    }
  }

  /**
   *  ...
   */
  updateUsers() {
    this.elements.users.innerHTML = ``;

    this.users.forEach(u => {
      let li = document.createElement("li");
      li.textContent = u;
      this.elements.users.appendChild(li);
    });
  }

  /**
   *
   */
  updateChat() {
    this.elements.chat.innerHTML = ``;

    this.chat.forEach(msg => {
      this.elements.chat.innerHTML += `<li>${msg.id}: ${msg.message}</li>\n`;
    });
  }
}
