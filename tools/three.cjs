// A local copy of Three.js for the browser checks. The game loads it from cdn.jsdelivr.net,
// which the checks block, so they serve this copy at the same URL instead.
const fs = require("fs");
const os = require("os");
const path = require("path");
const cp = require("child_process");

const URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js";
const LOCAL = path.join(__dirname, "vendor", "three.module.min.js");

function ensureThree() {
  if (fs.existsSync(LOCAL)) return LOCAL;
  fs.mkdirSync(path.dirname(LOCAL), { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "three-"));
  cp.execSync("npm pack three@0.160.0 --silent", { cwd: tmp, stdio: ["ignore", "pipe", "inherit"] });
  const tgz = fs.readdirSync(tmp).find((f) => f.endsWith(".tgz"));
  cp.execSync(`tar -xzf ${tgz} package/build/three.module.min.js`, { cwd: tmp });
  fs.copyFileSync(path.join(tmp, "package", "build", "three.module.min.js"), LOCAL);
  return LOCAL;
}

// Register after any catch-all route: Playwright tries the newest route first.
async function routeThree(page) {
  const file = ensureThree();
  await page.route(URL, (r) => r.fulfill({ path: file, headers: { "content-type": "text/javascript", "access-control-allow-origin": "*" } }));
}

module.exports = { URL, LOCAL, ensureThree, routeThree };
