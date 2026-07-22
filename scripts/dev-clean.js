if (!process.argv.includes("--force-clean")) {
  process.argv.push("--force-clean");
}

require("./dev.js");
