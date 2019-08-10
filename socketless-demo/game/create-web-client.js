/**
 * Creating a web client is a little bit crafty:
 *
 * We build clients on request, specifically: on a web request to
 * the game server by pressing the "join" button in its web interface.
 * As such, what we want to do is start a client, and then form a
 * web response that effects a browser redirect to the web client's
 * URL.
 *
 * Now, in order to make sure the client runs isolated from any other
 * code, we need to run it as its own process, which we do by spawning
 * the command `npm run game:client` that you would normally type in
 * the command prompt, and then we listen for its console output until
 * we see the line that tells us which port the web client can be found
 * on. When we sew that, we extract the port, and then form the web
 * server response that has been pending all this time.
 *
 * Of course, all of this happens in a matter of milliseconds, so the
 * user will never know anything crafty is happening, but you will!
 */
const { spawn } = require("child_process");

// We can't just run "npm", because on windows that is not actually
// a real command. Strictly speaking it's "npm.cmd" so we need to
// make sure we have the right command set up for our spawn call:
const npm = `npm${process.platform === "win32" ? `.cmd` : ``}`;

// Because we're going to be firing up a client as part of a web request
// to the game server, we need to return a request handling function.
module.exports = function createWebClient(request, response) {
  // step 1: start a web cient:
  const clientProcess = spawn(npm, [`run`, `game:client`]);

  // step 2: attach a listener for the console output, which means
  // attaching a listener to the client's process's stdout stream.
  // So, let's define the function we want to run on stdout data:
  let run = data => {
    // by default, `data` will be a Buffer() object, which is a byte stream,
    // which we can't use for string matching. So: convert it to string:
    data = data.toString(`utf-8`);

    // Then, if the output matches the line that we know contains the
    // client's port number, extract that port and form our web response:
    if (data.indexOf(`web client listening on `) > -1) {
      // Build the URL that the user's browser needs to be redirected to,
      // bassed on what their browser called in the first place. If they
      // connected to the server on a plain IP, use that. If they used a
      // named domain, use that. Basically "use whatever host the user
      // was already using, but with a different port":
      const host = request.headers.host.replace(/:\d+/g, "");
      const port = data.replace(`web client listening on `, ``).trim();
      const clientURL = `http://${host}:${port}`;
      console.log(`web client process reported ${clientURL} as live URL`);

      // And then as response we send a redirect instruction, in the form
      // of a "refresh" header pragma directive.
      response.writeHead(200, { refresh: `0;URL='${clientURL}'` });
      response.end();

      // Once we've done this,
      run = data => console.log(data.toString(`utf-8`));
    }
  };

  // still step 2: attach that listener.
  clientProcess.stdout.on("data", data => run(data));

  // step 3: for good measure, make sure we're logging errors. Just in case!
  clientProcess.stderr.on("data", data => console.error(data.toString()));
};
