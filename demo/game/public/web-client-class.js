const CLAIM_TYPES = [
  `cancel`,
  `chow1`,
  `chow2`,
  `chow3`,
  `pung`,
  `kong`,
  `win`
];

const WIN_TYPES = [`cancel`, `pair`, `chow1`, `chow2`, `chow3`, `pung`];

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
      `prompt`,
      `gamelist`,
      `games`,
      `lobby`,
      `users`,
      `chat`,
      `tiles`,
      `locked`,
      `playerinfo`,
      `discard`
    ].forEach(id => (this.elements[id] = document.getElementById(id)));
  }

  prompt(label, options) {
    return new Promise(resolve => {
      let prompt = this.elements.prompt;
      prompt.innerHTML = `<h1>${label}</h1>`;
      options.forEach(option => {
        let btn = document.createElement("button");
        btn.textContent = option;
        btn.addEventListener(`click`, () => {
          prompt.innerHTML = ``;
          resolve(btn.textContent);
        });
        prompt.appendChild(btn);
      });
    });
  }

  startDiscardTimer(timeout) {
    const claimtTimeStart = Date.now();
    const tick = () => {
      const passed = Date.now() - claimtTimeStart;
      if (passed > timeout) return this.updateDiscardTimer(1);
      const timeoutProgress = passed / timeout;
      this.claimTimeout = setTimeout(() => tick(), 500);
      this.updateDiscardTimer(timeoutProgress);
    };
    tick();
  }

  cancelDiscardTimer() {
    this.updateDiscardTimer(-1);
    clearTimeout(this.claimTimeout);
  }

  /**
   *  ...
   */
  async update() {
    console.log(`updating...`);
    this.updateGames();
    this.updateCurrentGame();
    this.updateDiscard();
    this.updateUserInfo();
    this.updateUsers();

    // A silly win notice
    if (this.winner) {
      console.log(this.winner);
      if (this.winner.id === this.id) {
        alert(`we won!`);
      } else {
        alert(
          `player ${this.winner.id} (seat ${this.winner.seat}) won the game!`
        );
      }
      this.winner = false;
    }
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
    this.elements.locked.innerHTML = ``;

    if (this.currentGame && this.tiles) {
      this.tiles.forEach(tilenumber => {
        let li = document.createElement(`li`);
        li.className = `tile`;
        li.dataset.tile = tilenumber;
        li.textContent = tilenumber;
        li.addEventListener("click", async () => {
          console.log("discarding");
          this.server.game.discardTile({ tilenumber });
        });
        this.elements.tiles.appendChild(li);
      });

      this.locked.forEach((set, setnum) => {
        set.forEach(tilenumber => {
          this.elements.locked.innerHTML += `<li class="tile" data-setnum="${setnum}" data-tile="${tilenumber}">${tilenumber}</li>`;
        });
      });

      // TODO: add in a "declare win" button if we have self-drawn a win
    }

    // TODO: add in rendering of other players concealed tiles + declared tiles
  }

  /**
   *  ...
   */
  updateDiscard() {
    this.elements.discard.innerHTML = ``;

    if (this.currentDiscard) {
      this.elements.discard.innerHTML = `Current discard: <span class="tile" data-tile="${this.currentDiscard.tilenumber}"></span>`;
      let tile = this.elements.discard.querySelector(`.tile`);

      // if this is not our tile, we can claim it.
      if (this.currentDiscard.id !== this.id) {
        console.log("adding tile event handler");

        tile.addEventListener(`click`, async () => {
          // TODO: add in a claim options filtering based on tiles in hand
          let claimtype = await this.prompt(`Claim type`, CLAIM_TYPES),
            wintype = false;
          if (claimtype === `cancel`) return;

          // TODO: add in a winning claim options filtering based on tiles in hand
          if (claimtype === `win`)
            wintype = await this.prompt(`Wining claim type`, WIN_TYPES);
          if (wintype === `cancel`) return;

          this.server.game.claim({ claimtype, wintype });
        });

        let btn = document.createElement("button");
        btn.className = "pass-button";
        btn.textContent = "pass";
        btn.addEventListener("click", () => {
          btn.disabled = true;
          this.server.game.pass();
        });
        this.elements.discard.appendChild(btn);
      }

      // if this IS our tile, we can take it back (as long as no one's laid a claim yet).
      else {
        tile.addEventListener(`click`, async () => {
          let result = await this.server.game.undoDiscard();
          if (!result.allowed) {
            // TODO: make this a visual signal
            console.log(`could not undo discard: ${result.reason}`);
          }
        });
      }
    }
  }

  /**
   * ...
   */
  updateDiscardTimer(value) {
    // TODO: make this a visual signal
    console.log(`discard timer ${value}`);
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

  async "game:setCurrentPlayer"(seat) {
    this.cancelDiscardTimer();
  }

  async "game:playerDiscarded"({ timeout }) {
    // set a timer for claiming the discard
    console.log(`starting a ${timeout}ms discard timer`);
    this.startDiscardTimer(timeout);
  }

  async "game:claimAwarded"() {
    this.cancelDiscardTimer();
  }

  async "game:playerTookBack"({ id, seat, tilenumber }) {
    // TODO: make this a visual signal
    console.log(`player ${id} (seat ${seat}) took back discard ${tilenumber}.`);
    this.cancelDiscardTimer();
  }

  async "game:playerPassed"({ id, seat }) {
    // TODO: make this a visual signal
    console.log(`player ${id} (seat ${seat}) passed on this discard.`);
  }
}
