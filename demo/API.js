/**
 * This is the most important requirement in this framework:
 *
 * an API definition that says which functions exist on the
 * client, and which functions exist on the server, as well
 * as which namespace those functions should use.
 */
const API = {

    admin: {
        client: [
            'register',
            'getStateDigest'
        ],
        server: []
    },

    user: {
        client: [
            'userJoined',
            'userLeft',
        ],
        server: [
            'setName',
            'getUserList'
        ]
    }

};

module.exports = API;
