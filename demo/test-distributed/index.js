// We're going to run our server and clients for real,
// by spawning actual processes for each of them.
const cmd = process.platform === "win32" ? "npm.cmd" : "npm";
const spawn = require("child_process").spawn;
const spawnConfig = { stdio: "inherit", detached: true };

// First, we spawn a process that will run the server:
spawn(cmd, ["run", "test:server"], spawnConfig);

// And then we spawn three more processes that will each run a client:
let clients = 3;
(function runClient() {
  if (clients--) {
    spawn(cmd, ["run", "test:client"], spawnConfig);
    setTimeout(runClient, 1000);
  }
})();
