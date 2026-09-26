// Loads the DOM-free part of index.html (everything before the UI block)
// into a sandbox so the game engine can be tested and simulated in Node.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadEngine(file) {
  const html = fs.readFileSync(file || path.join(__dirname, "..", "index.html"), "utf8");
  const start = html.indexOf("<script>");
  const end = html.indexOf("/* ===== UI ===== */");
  if (start < 0 || end < 0) throw new Error("Could not find the engine section in index.html");
  const src = html.slice(start + "<script>".length, end);
  const ctx = vm.createContext({ Math, Date, JSON, console, Object, Array, String, Number, isFinite, parseFloat, parseInt });
  vm.runInContext(src, ctx, { filename: "engine.js" });
  return ctx;
}
module.exports = { loadEngine };
