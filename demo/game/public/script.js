import WebClientClass from "./web-client-class.js";
const { server } = ClientServer.generateClientServer(WebClientClass);

// Set up a quit button
let quit = document.querySelector("#quit");
quit.addEventListener("click", async () => {
  server.quit();
  document.body.textContent = "This client has been shut down.";
});

// Set up a "create game" button
let create = document.querySelector("#create");
create.addEventListener("click", async () => {
  server.game.create();
});
