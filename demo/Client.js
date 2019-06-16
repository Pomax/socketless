/**
 * This is a demonstration client.
 */
class Client {
    constructor(socket, builder) {
        this.server = new builder.server(socket);
        this.server.onDisconnect(() => console.log(`client ${this.id}> disconnected from server.`))
        this.handler = new builder.handler(socket, this);
        this.users = [];
    }

    // ========================================================
    // Client's API functions, which get "called" by the server
    // ========================================================

    /**
     * Register ourselves as being part of the collective now.
     */
    async register(clientId) {
        console.log(`client> received registration id ${clientId}`);
        this.id = clientId;

        // Request the user list
        console.log(`client ${this.id}> requesting user list`);
        let list = await this.server.getUserList();
        console.log(`client ${this.id}> received user list`, list);
        this.users = list;

        // Schedule a disconnect 5 seconds in the future.
        setTimeout(async() => this.server.disconnect(), 5000);

        return { status: `registered` };
    }

    /**
     * Record the fact that another user joined the collective
     */
    async userJoined(user) {
        if (this.users.indexOf(user) === -1) this.users.push(user);
        console.log(`client ${this.id}> user ${user} joined. Known users:`, this.users);
    }

    /**
     * Record the fact that some user left the collective
     */
    async userLeft(user) {
        let pos = this.users.findIndex(u => (u === user));
        if (pos > -1) this.users.splice(pos,1);
        console.log(`client ${this.id}> user ${user} left. Known users:`, this.users);
    }

    /**
     * Provide the server with a full state digest upon request.
     * This is something a server may occasionally call in order
     * to verify that the client's knowledge of "all the things"
     * has not been corrupted (due to networking/timing issues,
     * for example, or because someone modified their client).
     */
    async getStateDigest() {
        console.log(`client ${this.id}> state digest requested.`);
        return { value: Math.random() };
    }
};

module.exports = Client;
