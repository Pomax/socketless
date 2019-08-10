// used by renderDiscard()
const CLAIM_TYPES = [`chow1`, `chow2`, `chow3`, `pung`, `kong`, `win`];
const WIN_TYPES = [`pair`, `chow1`, `chow2`, `chow3`, `pung`];
import RANDOM_NAMES from "./random-names.js";

// used by morphdom in update()
const onBeforeElUpdated = (fromEl, toEl) => !fromEl.isEqualNode(toEl);

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
    setTimeout(() => this.setRandomName(), 500);
    window.webclient = this;
  }

  setRandomName() {
    let name = RANDOM_NAMES[this.state.id];
    if (name) this.server.user.setName(name);
  }

  /**
   * This a socketless API function that gets called automatically
   * any time the remote client updates its state. The socketless
   * framework coordinates synchronization, and any time the
   * client state is updated, this function will run.
   */
  update(state) {
    // We "rebuild" the entire UI every time an update comes in,
    // which browsers can do REALLY REALLY FAST as long as you
    // don't update the live DOM until you're done, because it's
    // not the DOM that kills you, it's reflows. However, we're
    // actually going to be a little bit smarter even.
    const ui = main(
      { id: `client` },
      this.renderActiveGame(state),
      div(
        { id: `lobbydata` },
        state.currentGame
          ? undefined
          : section(
              { id: `gamelist` },
              ul({ id: `games` }, this.renderGames(state))
            ),
        section(
          { id: `lobby` },
          ul({ id: `users` }, this.renderUsers(state)),
          ul({ id: `chat` })
        )
      ),
      this.renderFooter(state)
    );

    // This is the smarter part: we regenerate the entire UI,
    // but we then use morphdom to only update those parts of
    // the dome that require updating, eeking out the maximum
    // speed by applying the trick mentioned over in the docs.

    morphdom(document.getElementById(`client`), ui, { onBeforeElUpdated });

    // See https://github.com/patrick-steele-idem/morphdom
    // for more information on why onBeforeElUpdated helps.

    // TODO: add in a persistent chat "window"
  }

  /**
   * This function renders the game that we're currently playing,
   * provided, of course, that we're involved in an active game.
   */
  renderActiveGame(state) {
    if (!state.currentGame) return;

    // If the game is over, we want a button that lets us
    // "leave" the active game and "return" to the lobby.
    const leaveGameButton = state.winner
      ? button(
          {
            className: `leave`,
            "on-click": () => this.server.game.leave()
          },
          `leave game`
        )
      : undefined;

    // An active game is a fairly straightforward affair:
    return section(
      { id: `active-game` },
      state.wall ? div({ id: `wall` }, this.renderWall(state)) : false,
      div({ id: `players` }, this.renderPlayers(state)),
      div({ id: `discard` }, this.renderDiscard(state)),
      div({ id: `prompt` }),
      leaveGameButton
    );
  }

  /**
   * This renders our local knowledge of what the wall
   * might still look like, in absence of knowing what
   * every other player is holding.
   */
  renderWall(state) {
    return Object.keys(state.wall).map(tilenumber => {
      let count = state.wall[tilenumber];
      if (count < 0)
        return console.error(`wall count for ${tilenumber} is ${count}`);
      return div(
        makearray(count).map(() =>
          li({ className: `tile`, "data-tile": tilenumber }, tilenumber)
        )
      );
    });
  }

  /**
   * There are two types of players that we need to render:
   * ourselves, and not-ourselves. As such, this function
   * is primarily a routing function that draws all the bits
   * that are shared between us and others, and delegates
   * the bits that are different to secondary functions.
   */
  renderPlayers(state) {
    return state.players.map(player => {
      const user = state.users.find(u => u.id === player.id);
      if (!user) return false;
      const props = {
        id: `seat-${player.seat}`,
        className: classes(`player`, {
          active: player.seat === state.currentPlayer,
          winner: state.winner && state.winner.id === player.id,
          left: player.left
        }),
        dataset: {
          seat: player.seat,
          wind: player.wind,
          name: user.name || user.id
        }
      };

      // As the only thing that differes is in showing
      // tiles, that's the only thing we delegate.
      return div(props, this.renderTiles(state, player));
    });
  }

  /**
   * This is purely a routing function for either our
   * own tiles (which we should see), or other player's
   * tiles (about which we know almost nothing).
   */
  renderTiles(state, player) {
    if (player.id === state.id) return this.renderOwnTiles(state);
    return this.renderOtherTiles(state, player);
  }

  /**
   * Rendering our own tiles is mostly a matter of just
   * doing that: render our tiles, then render our "locked"
   * sets of tiles, and any bonus tiles we may have picked up.
   * Finally, we also want to highlight the tile we just drew,
   * if it's our turn, because that makes play much easier
   * for human players.
   */
  renderOwnTiles(state) {
    const tiles = [
      this.renderHandTiles(state),
      this.renderLockedTiles(state),
      ul(
        { className: `bonus` },
        state.bonus.map(tilenumber =>
          li({ className: `tile`, "data-tile": tilenumber }, tilenumber)
        )
      ),
      this.renderWinButton(state)
    ];
    this.highlightLatest(state, tiles);
    return tiles;
  }

  /**
   * Render our own tiles: build `<li>` for each tile in this.tiles.
   */
  renderHandTiles(state) {
    const buildTile = tilenumber => {
      const props = {
        className: `tile`,
        "data-tile": tilenumber,
        "on-click": async evt => {
          let tilenumber = parseInt(evt.target.dataset.tile);
          if (!state.currentDiscard)
            this.server.game.discardTile({ tilenumber });
        }
      };
      return li(props, tilenumber);
    };

    return ul({ className: `tiles` }, state.tiles.map(buildTile));

    // TODO: add a way to declare a kong.
    // TODO: add a way to merge a kong.
  }

  /**
   * Render our locked tiles: in order to make sure we
   * show them in groups, we tag all tiles with their
   * respective "set number".
   */
  renderLockedTiles(state) {
    const buildTile = (tilenumber, setnum) =>
      li(
        {
          className: "tile",
          dataset: { setnum, tile: tilenumber }
        },
        tilenumber
      );
    const buildSet = (set, setnum) => set.map(t => buildTile(t, setnum));
    return ul({ className: `locked` }, state.locked.map(buildSet));
  }

  /**
   * When it's our turn, it's always possible that the tile
   * we just drew was the tile we were waiting on to win,
   * so make sure to add a button that lets us declare that
   * we've won. People might mistakenly click it, just like
   * how in a real game you might mistakenly declare a win.
   * This is very much intentional, and many rules cost you
   * a whole lot of points if you declare a win erroneously.
   */
  renderWinButton(state) {
    if (state.seat !== state.currentPlayer) return;
    if (state.winner) return;
    return button(
      {
        className: `declare-win-button`,
        "on-click": () => {
          if (confirm("Declare win?")) {
            this.server.game.declareWin();
          }
        }
      },
      `declare win`
    );
  }

  /**
   * In order to allow human players to track what just happened
   * during a deal, we want to highlight the latest received tile.
   */
  highlightLatest(state, tiles) {
    const latest = state.latestTile;
    if (latest) return;
    const qs = `.tile[data-tile="${latest}"]`;
    const tile = tiles[0].querySelector(qs);
    if (tile) tile.classList.add(`latest`);
  }

  /**
   * Rendering other player's tiles requires knowing how many tiles
   * they have in their hand, without actually knowing how many
   * tiles they have in their hand: all we know is how many tiles
   * they have "locked" so far. However, we know that at outset they
   * should have 13 tiles, so we first figure out how many tiles they
   * have locked, and then use that to determine how many tiles they
   * must therefore have left in their hand. Maths!
   */
  renderOtherTiles(state, player) {
    let tilecount = 13;

    // First, figure out how many tiles this player has locked
    const buildLocked = (set, setnum) => {
      // how many tiles are involved in this set?
      let { tilenumber, claimtype, wintype } = set;
      if (claimtype === `win`) claimtype = wintype;
      let chowtype = false;
      if (claimtype.startsWith(`chow`)) {
        chowtype = parseInt(claimtype.replace(`chow`, ``)) - 1;
      }
      let count = claimtype === `kong` ? 4 : 3;
      tilecount -= count;

      // Generate the "face up" tiles for this set, with some logic
      // that ensures for chows we generate a sequence.
      return makearray(count).map((_, i) => {
        let num = tilenumber + (chowtype === false ? 0 : i - chowtype);
        return li({ className: `tile`, dataset: { setnum, tile: num } }, num);
      });
    };

    const locked = (player.locked || []).map(buildLocked);

    // If this is the active player, and they've not discarded yet,
    // they will have one more tile because they just drew one, or
    // they just claimed something and have an extra tile that way.
    if (player.seat === state.currentPlayer && !state.currentDiscard) {
      tilecount++;
    }

    const buildTile = tilenumber =>
      li({ className: `tile`, "data-tile": tilenumber }, tilenumber);

    // Now we can generate the correct number of hidden tiles.
    // With one exception: if this game is over, we KNOW what tiles
    // that player is holding, and we can just directly generate them.
    // Did we do a bit more work in that case? Yes, but that's fine,
    // because it's rare, and imperceptibly fast.
    const tiles = player.tiles
      ? player.tiles.map(buildTile)
      : makearray(tilecount).map(() =>
          li({ className: `tile`, "data-tile": -1 })
        );

    // Finally, if this player is holding any bonus tiles, show those.
    let bonus;
    if (player.bonus) {
      bonus = ul({ className: `bonus` }, player.bonus.map(buildTile));
    }

    return [
      ul({ className: `tiles` }, tiles),
      ul({ className: `locked` }, locked),
      bonus
    ];
  }

  /**
   * The discard is a special tile that every player should be
   * able to click, but for different reasons:
   *
   * - the player that just discarded it should be able to take it back, and
   * - all other players should be able to place a claim on it.
   */
  renderDiscard(state) {
    if (!state.currentDiscard) return;

    let undoDiscard = false;
    if (state.currentDiscard.id === state.id) {
      undoDiscard = async evt => {
        let result = await this.server.game.undoDiscard();
        if (!result.allowed) evt.target.classList.add("claimed");
      };
    }

    const discardTile = span({
      className: `tile`,
      "data-tile": state.currentDiscard.tilenumber,
      "on-click": undoDiscard
    });

    let claimOptions = false;
    if (state.currentDiscard.id !== state.id) {
      claimOptions = span(
        { id: `discard-buttons` },
        this.renderClaimOptions(state)
      );
    }

    return span(
      `Current discard: `,
      discardTile,
      claimOptions,
      span({ id: `claim-timer` }, span({ id: `claim-timer-bar` }))
    );
  }

  // A helper function to determine whether we may claim a chow
  // from the discarding player.
  mayChow(state) {
    let l = state.players.length;
    let cs = (state.currentPlayer + 1) % l;
    return state.seat === cs;
  }

  /**
   * Claim options depend on the tile being playd, and the player's
   * tiles in hand. However, one option is always to pass.
   */
  renderClaimOptions(state) {
    const removeOptions = () => {
      document
        .querySelectorAll(`.claim-button`)
        .forEach(b => b.parentNode.removeChild(b));
    };

    const pass = () => {
      removeOptions();
      document.querySelector(`.pass-button`).disabled = true;
      this.server.game.pass();
    };

    return [
      button(
        {
          className: `btn pass-button`,
          "on-click": pass,
          disabled: state.passed
        },
        "pass"
      ),
      this.generateClaimButtons(state)
    ];
  }

  /**
   * Generate all the possible claims that we might be able to
   * make for this discard, including a "win" option - when clicked,
   * this will present us with all the ways we can claim a win,
   * rather than all the ways we can normally claim a tile.
   */
  generateClaimButtons(state) {
    if (state.passed) return;

    const removeOptions = () => {
      document
        .querySelectorAll(`.claim-button`)
        .forEach(b => b.parentNode.removeChild(b));
    };

    // Any claim that isn't a win leads to that claim getting
    // sent to the server for the current discard. There are
    // take-backies for claims!
    const processClaim = claimtype => {
      if (claimtype !== `win`) {
        document
          .querySelectorAll(`.claim-button, .pass-button`)
          .forEach(b => (b.disabled = true));
        return this.server.game.claim({ claimtype });
      }
    };

    // If a user clicks the win button, remove the regular
    // claim options and replace them with win options.
    const generateWinButtons = claimtype => {
      removeOptions();
      const buttonRow = document.querySelector(`.pass-button`).parentNode;

      // Generate the win options, which are subtly
      // different from the general claim optons.
      let claims = legalClaims(
        state.currentDiscard.tilenumber,
        state.tiles,
        this.mayChow(state),
        true
      );
      claims.forEach(c => {
        const wintype = c.type;
        const opt = {
          className: `btn claim-button win-button`,
          "on-click": () => {
            document
              .querySelectorAll(`.claim-button, .pass-button`)
              .forEach(b => (b.disabled = true));
            this.server.game.claim({ claimtype, wintype });
          }
        };
        const option = button(opt, wintype);
        buttonRow.appendChild(option);
      });
    };

    const makeButton = claimtype =>
      button(
        {
          className: `btn claim-button`,
          "on-click": () =>
            claimtype === "win"
              ? generateWinButtons(claimtype)
              : processClaim(claimtype)
        },
        claimtype
      );

    let claims = legalClaims(
      state.currentDiscard.tilenumber,
      state.tiles,
      this.mayChow(state)
    );
    return claims.map(c => makeButton(c.type));
  }

  /**
   * When a discard occurs, the server is already counting down to
   * close the claim window, and so we want to make sure that the
   * user gets some kind of visual feedback in terms of how close
   * we are to claim resolution.
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
   * Update the visual timer based on how far along we are.
   */
  updateDiscardTimer(value) {
    const bar = document.getElementById("claim-timer-bar");
    if (bar) bar.style.width = `${100 * value}%`;
  }

  /**
   * If you start a timer, you need to be able to stop it, too.
   */
  cancelDiscardTimer() {
    this.updateDiscardTimer(-1);
    clearTimeout(this.claimTimeout);
  }

  /**
   * Figure out which game we're playing in, if we're playing one.
   */
  getActiveGame(state) {
    if (state.currentGame) return true;
    return state.games.some(g =>
      g.players.some(p => p.id === state.id && g.id !== state.id)
    );
  }

  /**
   * This function renders "lobby" information relating to games:
   * which games have been created, who's in them, etc.
   * If a game hasn't started yet, offer players the option to
   * join, and if the player was the one who created the game,
   * offer them the option to start the game.
   */
  renderGames(state) {
    return state.games.map(g => {
      if (g.finished) return;

      let label = g.id === state.id ? "start" : "join";
      let item = li(
        { className: `game` },
        `game: `,
        strong(g.name),
        `, players: `,
        g.players
          .map(p => state.users.find(u => u.id === p.id).name || p.id)
          .join(", "),
        button({ disabled: this.getActiveGame(state) }, label)
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
   * This function renders "lobby" information relating to users:
   * show an entry for each client that the server thinks is connected.
   */
  renderUsers(state) {
    // If the user we're rendering is ourselves, offer a button
    // that lets us change our name. Because why not?
    const nameChangeButton = user => {
      if (user.id !== state.id) return;
      return [
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
      ];
    };

    // If we know a user's name, render them by name. Otherwise, by id.
    const renderUser = user =>
      li(
        { className: `user` },
        span({ className: `name` }, user.name || `unknown user ${user.id}`),
        nameChangeButton(user)
      );

    return state.users.map(renderUser);
  }

  /**
   * The footer contains the "create a game" and "quit from the server" buttons.
   */
  renderFooter(state) {
    // The create button and guide text.
    const create = p(
      `Create a game: `,
      button(
        { id: `create`, "on-click": () => this.server.game.create() },
        `create`
      )
    );

    // The quit button with guide text.
    const quit = p(
      `Disconnect from the server: `,
      button(
        {
          id: `quit`,
          "on-click": () => {
            this.server.quit();
            window.location.port = 8000;
          }
        },
        `quit`
      )
    );

    // And the footer, which just wraps those two.
    return footer(create, quit);
  }

  // ===========================================
  //
  //  The  following  functions  are  handlers
  //  that we  need to  explicitly  listen for
  //  because they act as signals for updating
  //  parts of  the UI,  but don't cause state
  //  changes in the client, and so don't lead
  //  to a call to update() by socketless.
  //
  // ===========================================

  /**
   * When the current player changes, we need to
   * cancel the discard timer. We could do this
   * by tracking the "previous" current player
   * and then in the update() function checking
   * whether that update's currentPlayer is the
   * same as, or different from, the previous
   * value, but that's quite a bit of code,
   * whereas we can also just listen for the
   * change signal and run one line of code.
   */
  async "game:setCurrentPlayer"(seat) {
    this.cancelDiscardTimer();
  }

  /**
   * When a discard occurs, start the discard
   * timer. Again, we could do this by adding
   * code to update() that checks whether the
   * currentDiscard value changed, but that's
   * again far more code than just listening
   * for the discard signal, instead.
   */
  async "game:playerDiscarded"({ timeout }) {
    this.startDiscardTimer(timeout);
  }

  /**
   * When a claim is awarded by the game
   * server, the discard is no longer relevant
   * and we should kill the timer. Again,
   * we could track this but you get the idea
   * by now.
   */
  async "game:claimAwarded"() {
    this.cancelDiscardTimer();
  }

  /**
   * When a player takes back their dicard,
   * the discard timer no longer applies.
   */
  async "game:playerTookBack"({ id, seat, tilenumber }) {
    this.cancelDiscardTimer();
  }
}
