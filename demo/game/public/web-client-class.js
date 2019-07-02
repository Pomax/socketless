export default class WebClientClass {
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

  async update() {
    this.elements.users.innerHTML = ``;

    this.elements.games.innerHTML = ``;
    this.games.forEach(g => {
      let li = document.createElement(`li`);
      let label = g.id === this.id ? "start" : "join";
      li.innerHTML = `<a>${JSON.stringify(g)} <button>${label}</button></a>`;
      this.elements.games.appendChild(li);
      let join = li.querySelector("button");
      if (g.inProgress) {
        join.disabled = true;
      } else {
        let joinOrStart = async () => {
          // if we're not joined, join.
          let join = await this.server.game.join(g.name);
          console.log(join);

          // if we are, start the game.
          let start = await this.server.game.start(g.name);
          console.log(start);

          // these two operations are mutually exclusive,
          // because owner can't join, and non-owners
          // can't start a game.

          join.removeEventListener(`click`, joinOrStart);
          join.disabled = true;
        };

        join.addEventListener(`click`, joinOrStart);
      }
    });

    if (this.currentGame && this.tiles) {
      this.elements.tiles.innerHTML = ``;
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

    if (this.currentDiscard) {
      this.elements.discard.innerHTML = `Current discard: <span class="tile" data-tile="${this.currentDiscard.tilenumber}"></span>`;
    }

    if (this.seat || this.wind) {
      this.elements.playerinfo.textContent = `seat: ${this.seat}, wind: ${this.wind}`;
    }

    this.users.forEach(u => {
      let li = document.createElement("li");
      li.textContent = u;
      this.elements.users.appendChild(li);
    });
  }

  async "game:updated"(details) {
    console.log(`game updated:`, details);
  }

  async "chat:message"({ id, message }) {
    this.elements.chat.innerHTML += `<li>${id}: ${message}</li>\n`;
  }
}
