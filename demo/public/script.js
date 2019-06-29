import ClientClass from "./client-class.js";
const { client, server } = ClientServer.generateClientServer(ClientClass);

// Set up a quit button
let quit = document.querySelector('#quit');
quit.addEventListener('click', () => server.quit());

// Set up a button that can ask the server (through the
// client) for the list of currently connected users.
let list = document.querySelector('#list');
list.addEventListener('click', async() => {
    let list = await server.user.getUserList();
    console.log(list);
    client.users = list;
    client.updated();
});
