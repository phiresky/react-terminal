const fs = require('fs');
const path = require('path');
const cp = require('child_process');
if (!fs.existsSync(path.join(__dirname, "build", ".git"))) {
    console.log("setting up worktree");
    cp.spawnSync("git", ["worktree", "prune"]);
    const ret = cp.execSync("git worktree add build gh-pages");
    console.log(ret.toString('utf8'));
}
const p = cp.spawn("webpack", ["--colors"], { env: { NODE_ENV: "production" } });
p.stdout.pipe(process.stdout);
p.stderr.pipe(process.stderr);
p.on('close', e => {
    const options = { cwd: path.join(__dirname, "build") };
    cp.spawnSync("git", ["add", "."], options);
    cp.spawnSync("git", ["commit", "-m", `build: ${new Date().toLocaleString()}`], options);
});