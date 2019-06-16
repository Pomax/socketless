/**
 * This is the most important requirement in this framework:
 *
 * an API definition that says which functions exist on the
 * client, and which functions exist on the server, as well
 * as which namespace those functions should use.
 */
const API = {
    user: { // namespace
        client: [ // used to generate an "on" handler object, and a client representation for the server
            'register',
            'userJoined',
            'userLeft',
            'getStateDigest'
        ],
        server: [ // used to generate an "on" handler object, and a server representation for the client
            'setName',
            'getUserList'
        ]
    }
};

module.exports = API;
