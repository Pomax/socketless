const cmd = process.platform === "win32" ? "npm.cmd" : "npm";
const spawn = require("child_process").spawn;
const spawnConfig = { stdio: "inherit" };

spawn(cmd, ["run", "game:server"], spawnConfig);

setTimeout(() => {
    spawn(cmd, ["run", "game:client"], spawnConfig);
    spawn(cmd, ["run", "game:client"], spawnConfig);
    spawn(cmd, ["run", "game:client"], spawnConfig);
    spawn(cmd, ["run", "game:client"], spawnConfig);    
}, 250);
