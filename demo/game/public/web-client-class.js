export default class WebClientClass {
  constructor() {
    this.elements = {};
    ["gamelist", "games", "lobby", "users", "chat"].forEach(
      id => (this.elements[id] = document.getElementById(id))
    );
  }

  async update() {
    this.elements.users.innerHTML = "";

    this.elements.games.innerHTML = "";
    this.games.forEach(g => {
      let li = document.createElement("li");
      li.innerHTML = `<a>${JSON.stringify(g)}</a>`;
      this.elements.games.appendChild(li);
      li.addEventListener("click", async () => {
        this.server.game.join(g.name);
      });
    });

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
