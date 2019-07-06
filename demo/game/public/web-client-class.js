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
    window.WebClientInstance = this;
  }

  update() {
    const ui = main(
      { id: `client` },
      this.renderActiveGame(),
      div(
        { id: `lobbydata` },
        section({ id: `gamelist` }, ul({ id: `games` }, ...this.renderGames())),
        section(
          { id: `lobby` },
          ul({ id: `users` }, ...this.renderUsers()),
          ul({ id: `chat` })
        )
      )
    );
    const pageelement = document.getElementById(`client`);
    pageelement.parentNode.replaceChild(ui, pageelement);
  }

  /**
   * ...
   */
  renderActiveGame() {
    return section(
      { id: `active-game` },
      span({ id: `playerinfo` }, this.renderPlayerInfo()),
      div({ id: `players` }, ...this.renderPlayers()),
      div({ id: `discard` }, this.renderDiscard()),
      div({ id: `prompt` })
    );
  }

  /**
   * ...
   */
  renderPlayerInfo() {
    if (this.seat || this.wind) {
      return `seat: ${this.seat}, wind: ${this.wind}`;
    }
  }

  /**
   * ...
   */
  renderPlayers() {
    return this.players.map(player => {
      return div(
        {
          id: `seat-${player.seat}`,
          className: `player`,
          "data-seat": player.seat,
          "data-wind": player.wind
        },
        ul({ className: `tiles` }, ...this.renderTiles(player)),
        ul({ className: `locked` }, ...this.renderLocked(player))
      );
    });
  }

  /**
   * ...
   */
  renderTiles(player) {
    if (player.id === this.id) {
      const tiles = this.tiles.map(tilenumber => {
        return li(
          {
            className: `tile`,
            "data-tile": tilenumber,
            "on-click": async () => {
              console.log("discarding");
              if (!this.currentDiscard) {
                this.server.game.discardTile({ tilenumber });
              }
            }
          },
          tilenumber
        );
      });

      if (this.latestTile) {
        let latest = tiles.find(item => item.dataset.tile == this.latestTile);
        if (latest) latest.classList.add("latest");
      }

      return tiles;
    } else {
      let tilecount = 13;

      if (player.locked)
        player.locked.forEach(claim => {
          let { claimtype, wintype } = claim;
          if (claimtype === "win") claimtype = wintype;
          let count = claimtype === "kong" ? 4 : 3;
          tilecount -= count;
        });

      if (player.seat === this.currentPlayer && !this.currentDiscard) {
        tilecount++;
      }

      return new Array(tilecount)
        .fill(0)
        .map(_ => li({ className: `tile`, "data-tile": -1 }));
    }
  }

  /**
   * ...
   */
  renderLocked(player) {
    if (player.id === this.id) {
      const locked = [];

      this.locked.map((set, setnum) => {
        set.forEach(tilenumber => {
          locked.push(
            li(
              {
                className: "tile",
                "data-setnum": setnum,
                "data-tile": tilenumber
              },
              tilenumber
            )
          );
        });
      });

      return locked;
    } else {
      const locked = [];

      if (player.locked) {
        player.locked.forEach((claim, setnum) => {
          let { tilenumber, claimtype, wintype } = claim;
          if (claimtype === "win") claimtype = wintype;
          let count = claimtype === "kong" ? 4 : 3;
          for (let i = 0; i < count; i++) {
            locked.push(
              li({
                className: "tile",
                "data-setnum": setnum,
                "data-tile": tilenumber + (claimtype.startsWith("chow") ? i : 0)
              })
            );
          }
        });
      }

      return locked;
    }
  }

  /**
   * ...
   */
  renderDiscard() {
    if (!this.currentDiscard) return;

    const discard = span(
      `Current discard: `,
      span({
        className: `tile`,
        "data-tile": this.currentDiscard.tilenumber
      })
    );

    let tile = discard.querySelector(`.tile`);
    this.addDiscardClickHandling(discard, tile);
    return discard;
  }

  /**
   * ...
   */
  addDiscardClickHandling(discard, tile) {
    // if this is not our tile, we can claim it.
    if (this.currentDiscard.id !== this.id) {
      console.log("adding tile event handler");

      let passbtn = button({ className: `pass-button` }, `pass`);

      passbtn.addEventListener("click", () => {
        passbtn.disabled = true;
        this.server.game.pass();
      });

      discard.appendChild(passbtn);

      let claimbtn = button({ className: "claim-button" }, "claim");

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

      discard.appendChild(claimbtn);
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

  /**
   * ...
   */
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

  /**
   * ...
   */
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

  /**
   * ...
   */
  cancelDiscardTimer() {
    this.updateDiscardTimer(-1);
    clearTimeout(this.claimTimeout);
  }

  /**
   *  ...
   */
  renderGames() {
    return this.games.map(g => {
      let label = g.id === this.id ? "start" : "join";
      let item = li(a(JSON.stringify(g), button(label)));

      let join = item.querySelector("button");
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

      return item;
    });
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
  renderUsers() {
    return this.users.map(u => li(u));
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
