import WebClientClass from "./web-client-class.js";
const { client, server } = ClientServer.generateClientServer(WebClientClass);

// Set up a quit button
let quit = document.querySelector("#quit");
quit.addEventListener("click", () => {
  server.quit();
  document.body.textContent = "The client has been shut down.";
});

// Set up a button that can ask the server (through the
// client) for the list of currently connected users.
let list = document.querySelector("#list");
list.addEventListener("click", async () => {
  await client.sync();
  client.update();
});
