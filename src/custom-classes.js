export class ServerClass {

    clients = [];

    constructor() {
        // ...
    }


}

export class ClientClass {
    // ...
}

export class UpgradedSocket extends Websocket {
    static upgrade(socket) {
        socket.__proto__ = new UpgradedSocket();
        return socket;
    }
}

