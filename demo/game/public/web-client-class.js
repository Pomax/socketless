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
      `lobbydata`,
      `users`,
      `players`,
      `chat`,
      `playerinfo`,
      `discard`
    ].forEach(id => (this.elements[id] = document.getElementById(id)));

    window.WebClientInstance = this;
  }

  prompt(label, options) {
    return new Promise(resolve => {
      let prompt = this.elements.prompt;
      //prompt.innerHTML = `<h1>${label}</h1>`;
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

  resetUI() {
    this.elements.games.innerHTML = ``;
    this.elements.users.innerHTML = ``;
    this.elements.discard.innerHTML = ``;


    this.elements.players.innerHTML = ``;
    this.playerElements = [];
    this.players.forEach( p => {
      let seat = p.seat;
      let div = document.createElement('div');
      div.id = `seat-${seat}`;
      div.className = `player`;

      div.dataset.seat = seat;
      div.dataset.wind = p.wind;

      div.innerHTML = `
        <ul class="tiles"></ul>
        <ul class="locked"></ul>
      `;

      this.elements.players.appendChild(div);
      this.playerElements[seat] = div;
    });

    if (this.currentGame !== undefined) {
      this.elements.lobbydata.style.display = "none";
    }
  }

  /**
   *  ...
   */
  async update() {
    this.resetUI();

    this.updateGames();
    this.updateUserInfo();
    this.updateUsers();
    this.updateCurrentGame();
    this.updateDiscard();

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
    if (this.players) {
      this.playerElements.forEach( (element, seat) => {
        if (seat === this.seat) {

          this.tiles.forEach(tilenumber => {
            let li = document.createElement(`li`);
            li.className = `tile`;
            li.dataset.tile = tilenumber;
            li.textContent = tilenumber;
            li.addEventListener("click", async () => {
              console.log("discarding");
              this.server.game.discardTile({ tilenumber });
            });
            element.querySelector('.tiles').appendChild(li);
          });

          if (this.latestTile) {
            element.querySelector(`.tiles .tile[data-tile="${this.latestTile}"]`).classList.add('latest');
          }

          this.locked.forEach((set, setnum) => {
            set.forEach(tilenumber => {
              element.querySelector('.locked').innerHTML += `<li class="tile" data-setnum="${setnum}" data-tile="${tilenumber}">${tilenumber}</li>`;
            });
          });
        }

        else {
          let player = this.players[seat];
          let tilecount = 13;

          if (player.locked) {
            player.locked.forEach( (claim, setnum) => {
              let { tilenumber, claimtype, wintype } = claim;
              if (claimtype === 'win') claimtype = wintype;
              let count = (claimtype === 'kong') ? 4 : 3;
              for (let i=0; i<count; i++) {
                let html = `<li class="tile" data-setnum="${setnum}" data-tile="${ tilenumber + (claimtype.startsWith('chow') ? i : 0) }"></li>`;
                element.querySelector('.locked').innerHTML += html;
              }
              tilecount -= count;
            })
          }

          if (seat === this.currentPlayer && !this.currentDiscard) {
            tilecount++;
          }

          while(tilecount--) {
            element.querySelector('.tiles').innerHTML += `<li class="tile" data-tile="-1"></li>`;
          }
        }
      });
    }
    // TODO: add in a "declare win" button if we have self-drawn a win
    // TODO: add in rendering of other players concealed tiles + declared tiles
  }

  /**
   *  ...
   */
  updateDiscard() {
    if (this.currentDiscard) {
      this.elements.discard.innerHTML = `Current discard: <span class="tile" data-tile="${this.currentDiscard.tilenumber}"></span>`;
      let tile = this.elements.discard.querySelector(`.tile`);

      // if this is not our tile, we can claim it.
      if (this.currentDiscard.id !== this.id) {
        console.log("adding tile event handler");

        let passbtn = document.createElement("button");
        passbtn.className = "pass-button";
        passbtn.textContent = "pass";
        passbtn.addEventListener("click", () => {
          passbtn.disabled = true;
          this.server.game.pass();
        });
        this.elements.discard.appendChild(passbtn);

        let claimbtn = document.createElement("button");
        claimbtn.className = "claim-button";
        claimbtn.textContent = "claim";
        claimbtn.addEventListener("click", async () => {
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

        this.elements.discard.appendChild(claimbtn);
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
    if (this.seat || this.wind) {
      this.elements.playerinfo.textContent = `seat: ${this.seat}, wind: ${this.wind}`;
    }
  }

  /**
   *  ...
   */
  updateUsers() {
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
    this.chat.forEach(msg => {
      this.elements.chat.innerHTML += `<li>${msg.id}: ${msg.message}</li>\n`;
    });
  }

  async "game:setCurrentPlayer"(seat) {
    // TODO: make this a visual signal
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
