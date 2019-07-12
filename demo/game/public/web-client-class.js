const CLAIM_TYPES = [`chow1`, `chow2`, `chow3`, `pung`, `kong`, `win`];
const WIN_TYPES = [`pair`, `chow1`, `chow2`, `chow3`, `pung`];

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
  constructor() {
    setTimeout(() => {
      let name = [
        "angelo",
        "bartholomew",
        "chantal",
        "dmietri",
        "evert",
        "francesca",
        "gregory"
      ][this.id];
      this.server.user.setName(name);
    }, 500);
  }

  /**
   * ...
   */
  update() {
    const ui = main(
      { id: `client` },
      this.renderActiveGame(),
      div(
        { id: `lobbydata` },
        this.currentGame
          ? undefined
          : section(
              { id: `gamelist` },
              ul({ id: `games` }, this.renderGames())
            ),
        section(
          { id: `lobby` },
          ul({ id: `users` }, this.renderUsers()),
          ul({ id: `chat` })
        )
      )
    );
    morphdom(document.getElementById(`client`), ui);

    window.webclient = this;
  }

  /**
   * ...
   */
  renderActiveGame() {
    if (!this.currentGame) return;
    return section(
      { id: `active-game` },
      div({ id: `players` }, this.renderPlayers()),
      div({ id: `discard` }, this.renderDiscard()),
      div({ id: `prompt` }),
      this.winner
        ? button(
            {
              className: `leave`,
              "on-click": () => this.server.game.leave()
            },
            `leave game`
          )
        : undefined
    );
  }

  /**
   * ...
   */
  renderPlayers() {
    return this.players.map(player => {
      let user = this.users.find(u => u.id === player.id);
      return div(
        {
          id: `seat-${player.seat}`,
          className: [
            `player`,
            player.seat === this.currentPlayer ? `active` : ``,
            this.winner && this.winner.id === player.id ? `winner` : ``,
            player.left ? `left` : ``
          ]
            .join(" ")
            .trim(),
          "data-seat": player.seat,
          "data-wind": player.wind,
          "data-name": user.name || user.id
        },
        this.renderTiles(player)
      );
    });
  }

  /**
   * ...
   */
  renderTiles(player) {
    if (player.id === this.id) {
      return this.renderOwnTiles();
    }
    return this.renderOtherTiles(player);
  }

  /**
   * ...
   */
  renderOwnTiles() {
    const tiles = [
      this.renderHandTiles(),
      this.renderLockedTiles(),
      ul(
        { className: `bonus` },
        this.bonus.map(tilenumber =>
          li({ className: `tile`, "data-tile": tilenumber }, tilenumber)
        )
      ),
      this.renderWinButton()
    ];
    this.highlightLatest(tiles);
    return tiles;
  }

  /**
   * ...
   */
  renderHandTiles() {
    return ul(
      { className: `tiles` },
      this.tiles.map(tilenumber =>
        li(
          {
            className: `tile`,
            "data-tile": tilenumber,
            "on-click": async evt => {
              let tilenumber = parseInt(evt.target.dataset.tile);
              if (!this.currentDiscard) {
                this.server.game.discardTile({ tilenumber });
              }
              // TODO: add a way to declare a kong.
              // TODO: add a way to merge a kong.
            }
          },
          tilenumber
        )
      )
    );
  }

  /**
   * ...
   */
  renderLockedTiles() {
    return ul(
      { className: `locked` },
      this.locked.map((set, setnum) =>
        set.map(tilenumber =>
          li(
            {
              className: "tile",
              "data-setnum": setnum,
              "data-tile": tilenumber
            },
            tilenumber
          )
        )
      )
    );
  }

  /**
   * ...
   */
  renderWinButton() {
    return this.seat === this.currentPlayer && !this.winner
      ? button(
          {
            className: `declare-win-button`,
            "on-click": () => {
              if (confirm("Declare win?")) {
                this.server.game.declareWin();
              }
            }
          },
          `declare win`
        )
      : undefined;
  }

  /**
   * ...
   */
  highlightLatest(tiles) {
    // highlight the just-draw tile (or rather, any one
    // tile that matches the just-dealt tile's tilenumber).
    if (this.latestTile) {
      let tile = tiles[0].querySelector(
        `.tile[data-tile="${this.latestTile}"]`
      );
      if (tile) {
        tile.classList.add(`latest`);
      } else {
        console.log(`Could not find ${this.latestTile} in hand?`, this.tiles);
      }
    }
  }

  /**
   * ...
   */
  renderOtherTiles(player) {
    let tilecount = 13;

    let locked = (player.locked || []).map((claim, setnum) => {
      let { tilenumber, claimtype, wintype } = claim;
      if (claimtype === `win`) claimtype = wintype;
      let chowtype = false;
      if (claimtype.startsWith(`chow`)) {
        chowtype = parseInt(claimtype.replace(`chow`, ``)) - 1;
      }
      let count = claimtype === `kong` ? 4 : 3;
      tilecount -= count;
      return makearray(count).map((_, i) => {
        let num = tilenumber + (chowtype === false ? 0 : i - chowtype);
        return li(
          {
            className: `tile`,
            "data-setnum": setnum,
            "data-tile": num
          },
          num
        );
      });
    });

    if (player.seat === this.currentPlayer && !this.currentDiscard) {
      tilecount++;
    }

    return [
      ul(
        { className: `tiles` },
        player.tiles
          ? player.tiles.map(tilenumber =>
              li({ className: `tile`, "data-tile": tilenumber }, tilenumber)
            )
          : makearray(tilecount).map(() =>
              li({ className: `tile`, "data-tile": -1 })
            )
      ),
      ul({ className: `locked` }, locked),
      player.bonus
        ? ul(
            { className: `bonus` },
            player.bonus.map(tilenumber =>
              li({ className: `tile`, "data-tile": tilenumber }, tilenumber)
            )
          )
        : false
    ];
  }

  /**
   * ...
   */
  renderDiscard() {
    if (!this.currentDiscard) return;

    return span(
      `Current discard: `,
      span({
        className: `tile`,
        "data-tile": this.currentDiscard.tilenumber,
        "on-click": async () => {
          if (this.currentDiscard.id === this.id) {
            let result = await this.server.game.undoDiscard();
            if (!result.allowed) {
              // TODO: make this a visual signal
              console.log(`could not undo discard: ${result.reason}`);
            }
          }
        }
      }),
      span({ id: `discard-buttons` }, this.discardButtons()),
      span({ id: `claim-timer` }, span({ id: `claim-timer-bar` }))
    );
  }

  /**
   *
   */
  generateClaimButtons() {
    // TODO: add in a claim options filtering based on tiles in hand
    // TODO: add in a winning claim options filtering based on tiles in hand
    return CLAIM_TYPES.map(claimtype =>
      button(
        {
          className: `btn claim-button`,
          "on-click": async () => {
            if (claimtype === `win`) {
              document
                .querySelectorAll(`.claim-button`)
                .forEach(b => b.parentNode.removeChild(b));

              const buttonRow = document.querySelector(`.pass-button`)
                .parentNode;

              WIN_TYPES.forEach(wintype => {
                console.log(`add ${wintype}`);
                buttonRow.appendChild(
                  button(
                    {
                      className: `btn claim-button win-button`,
                      "on-click": () => {
                        document
                          .querySelectorAll(`.claim-button, .pass-button`)
                          .forEach(b => (b.disabled = true));
                        this.server.game.claim({ claimtype, wintype });
                      }
                    },
                    wintype
                  )
                );
              });
            } else {
              document
                .querySelectorAll(`.claim-button, .pass-button`)
                .forEach(b => (b.disabled = true));
              this.server.game.claim({ claimtype });
            }
          }
        },
        claimtype
      )
    );
  }

  /**
   * ...
   */
  discardButtons() {
    if (this.currentDiscard.id !== this.id) {
      return [
        button(
          {
            className: `btn pass-button`,
            "on-click": evt => {
              document
                .querySelectorAll(`.claim-button`)
                .forEach(b => b.parentNode.removeChild(b));
              document.querySelector(`.pass-button`).disabled = true;
              this.server.game.pass();
            }
          },
          "pass"
        ),

        this.generateClaimButtons()
      ];
    }
  }

  /**
   * ...
   */
  prompt(label, options) {
    return new Promise(resolve => {
      let prompt = document.querySelector("#prompt");
      //prompt.innerHTML = `<h1>${label}</h1>`;
      options.forEach(option => {
        let btn = button(
          {
            "on-click": () => {
              prompt.innerHTML = ``;
              resolve(btn.textContent);
            }
          },
          option
        );
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
      this.claimTimeout = setTimeout(() => tick(), 100);
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
   * ...
   */
  inGame() {
    if (this.currentGame) return true;
    return this.games.some(g =>
      g.players.some(p => p.id === this.id && g.id !== this.id)
    );
  }

  /**
   *  ...
   */
  renderGames() {
    return this.games.map(g => {
      if (g.finished) return;
      let label = g.id === this.id ? "start" : "join";
      let item = li(
        { className: `game` },
        `game: `,
        strong(g.name),
        `, players: `,
        g.players
          .map(p => this.users.find(u => u.id === p.id).name || p.id)
          .join(", "),
        button({ disabled: this.inGame() }, label)
      );

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
    const bar = document.getElementById("claim-timer-bar");
    if (bar) bar.style.width = `${100 * value}%`;
  }

  /**
   *  ...
   */
  renderUsers() {
    return this.users.map(u => {
      return li(
        { className: `user` },
        span({ className: `name` }, u.name || `unknown user ${u.id}`),
        u.id !== this.id
          ? ``
          : [
              ` ←`,
              button(
                {
                  className: `rename`,
                  "on-click": () => {
                    let name = prompt("your name?");
                    if (name && name.trim()) {
                      this.server.user.setName(name);
                    }
                  }
                },
                `change name`
              )
            ]
      );
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

  // ======================

  /**
   * ...
   */
  async "game:setCurrentPlayer"(seat) {
    // TODO: make this a visual signal
    this.cancelDiscardTimer();
  }

  /**
   * ...
   */
  async "game:playerDiscarded"({ timeout }) {
    // set a timer for claiming the discard
    console.log(`starting a ${timeout}ms discard timer`);
    this.startDiscardTimer(timeout);
  }

  /**
   * ...
   */
  async "game:claimAwarded"() {
    this.cancelDiscardTimer();
  }

  /**
   * ...
   */
  async "game:playerTookBack"({ id, seat, tilenumber }) {
    // TODO: make this a visual signal
    console.log(`player ${id} (seat ${seat}) took back discard ${tilenumber}.`);
    this.cancelDiscardTimer();
  }

  /**
   * ...
   */
  async "game:playerPassed"({ id, seat }) {
    // TODO: make this a visual signal
    console.log(`player ${id} (seat ${seat}) passed on this discard.`);
  }
}
