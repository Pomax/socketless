import ClientClass from "./client-class.js";

const { server } = ClientServer.generateClientServer(ClientClass);

let quit = document.querySelector('#quit');
quit.addEventListener('click', () => server.quit());

let list = document.querySelector('#list');
list.addEventListener('click', async() => {
    let list = await server.user.getUserList();
    console.log(list);
});
