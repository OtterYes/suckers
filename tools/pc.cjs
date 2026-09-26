// Builds the PC edition: a folder you unzip anywhere and play offline, 3D city included.
//   node tools/pc.cjs        -> dist/Grind-to-1520/ and dist/Grind-to-1520-PC.zip
// The game file gets Three.js and the fonts built in, and a launcher opens it in its own
// window. Fonts and licenses are downloaded once into tools/vendor/ (not committed).
const fs = require("fs");
const path = require("path");
const cp = require("child_process");
const { ensureThree, LICENSE } = require("./three.cjs");

const ROOT = path.resolve(__dirname, "..");
const VENDOR = path.join(__dirname, "vendor");
const DIST = path.join(ROOT, "dist");
const NAME = "Grind-to-1520";
const OUT = path.join(DIST, NAME);
const FONT_CSS = "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Chakra+Petch:wght@500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap";
const FONTS = { "Atkinson Hyperlegible": "atkinsonhyperlegible", "Chakra Petch": "chakrapetch", "JetBrains Mono": "jetbrainsmono" };
// Google Fonts serves WOFF2 to modern browsers only, so ask as one.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const get = (url, file) => cp.execFileSync("curl", ["-sSfL", "-m", "60", "-A", UA, "-o", file, url]);
const crlf = (s) => s.replace(/\r?\n/g, "\r\n");

// The Latin subset of each font as data URLs, plus each font's license.
function fontCSS() {
  const dir = path.join(VENDOR, "fonts");
  const css = path.join(dir, "fonts.css");
  if (!fs.existsSync(css)) {
    fs.mkdirSync(dir, { recursive: true });
    const raw = path.join(dir, "google.css");
    get(FONT_CSS, raw);
    const blocks = fs.readFileSync(raw, "utf8").split("/* ").filter((b) => b.startsWith("latin */"));
    if (blocks.length < 9) throw new Error("expected 9 Latin font faces, got " + blocks.length);
    const faces = blocks.map((b, i) => {
      const url = b.match(/url\((https:[^)]+\.woff2)\)/)[1];
      const file = path.join(dir, "face" + i + ".woff2");
      get(url, file);
      return "/* " + b.replace(url, () => "data:font/woff2;base64," + fs.readFileSync(file).toString("base64")).trim();
    });
    for (const slug of Object.values(FONTS)) get(`https://raw.githubusercontent.com/google/fonts/main/ofl/${slug}/OFL.txt`, path.join(dir, slug + "-OFL.txt"));
    fs.writeFileSync(css, faces.join("\n"));
  }
  return fs.readFileSync(css, "utf8");
}

const LAUNCHER = `@echo off
rem Opens Grind to 1520 in its own window, like an app: Chrome if it's installed, otherwise Edge.
setlocal
set "GAME=%~dp0grind-to-1520.html"
set "URL=file:///%GAME:\\=/%"
set "APP="
reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe" >nul 2>&1
if not errorlevel 1 set "APP=chrome"
if not defined APP (
  reg query "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe" >nul 2>&1
  if not errorlevel 1 set "APP=chrome"
)
if not defined APP (
  reg query "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\msedge.exe" >nul 2>&1
  if not errorlevel 1 set "APP=msedge"
)
if defined APP (
  start "" %APP% --app="%URL%"
) else (
  start "" "%GAME%"
)
`;

const README = `GRIND TO 1520, PC EDITION

To play, double-click "Play Grind to 1520". It opens the game in its own window, using
Chrome if you have it and Edge if you don't. You can also double-click grind-to-1520.html
to play in a normal browser tab.

Everything works offline, including the 3D city.

YOUR PROGRESS
Your browser saves your progress on this computer. When you get a new version, save the
new grind-to-1520.html over the old one in this folder, and keep playing in the same
browser. For a backup, open Settings (the gear at the top right) and copy your Backup code.
To bring progress over from another copy of the game, paste its Backup code there and
press Restore.

IF WINDOWS WARNS YOU
Windows may ask before running the launcher, because it came from the internet. Choose
"More info", then "Run anyway". Or just open grind-to-1520.html directly.

The licenses folder has the licenses for Three.js (the 3D engine) and the fonts.
`;

function build() {
  const three = fs.readFileSync(ensureThree(), "utf8");
  if (/<\/script|<!--/i.test(three)) throw new Error("this Three.js build can't be inlined as-is");
  let html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const link = html.match(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/);
  if (!link) throw new Error("font link not found in index.html");
  const fonts = fontCSS();
  html = html.replace(/<link rel="preconnect"[^>]*>\r?\n?/g, "").replace(link[0], () => "<style>" + fonts + "</style>");
  const at = html.indexOf("<script>");
  if (at < 0) throw new Error("main script not found");
  html = html.slice(0, at) + '<script type="text/plain" id="three-src">' + three + "</script>\n" + html.slice(at);
  // claude.ai adds the page header when it publishes; a file opened from disk needs its own,
  // or the browser guesses the text encoding and renders in quirks mode.
  if (!/^\s*<!doctype/i.test(html)) html = '<!doctype html>\n<html lang="en">\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' + html;

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, "licenses"), { recursive: true });
  fs.writeFileSync(path.join(OUT, "grind-to-1520.html"), html);
  fs.writeFileSync(path.join(OUT, "Play Grind to 1520.bat"), crlf(LAUNCHER));
  fs.writeFileSync(path.join(OUT, "README.txt"), crlf(README));
  fs.copyFileSync(LICENSE, path.join(OUT, "licenses", "Three.js LICENSE.txt"));
  for (const [font, slug] of Object.entries(FONTS)) fs.copyFileSync(path.join(VENDOR, "fonts", slug + "-OFL.txt"), path.join(OUT, "licenses", font + " OFL.txt"));

  const zip = path.join(DIST, NAME + "-PC.zip");
  fs.rmSync(zip, { force: true });
  cp.execFileSync("zip", ["-qr", zip, NAME], { cwd: DIST });
  console.log("built", path.relative(ROOT, OUT), "and", path.relative(ROOT, zip), "(" + Math.round(fs.statSync(zip).size / 1024) + " KB)");
}

build();
