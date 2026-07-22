const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const nextDir = path.join(process.cwd(), ".next");
const ports = [3000, 3001, 3002];

function sleepSync(ms) {
  execSync(`powershell -Command "Start-Sleep -Milliseconds ${ms}"`, { stdio: "ignore" });
}

function killPortListeners() {
  let stopped = 0;

  for (const port of ports) {
    try {
      const output = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" });
      const pids = new Set();

      for (const line of output.split("\n")) {
        const match = line.trim().match(/LISTENING\s+(\d+)\s*$/i);
        if (match) pids.add(match[1]);
      }

      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /F /T`, { stdio: "ignore" });
          console.log(`Stopped stale dev process ${pid} on port ${port}`);
          stopped += 1;
        } catch {
          // Process may already be gone.
        }
      }
    } catch {
      // No listener on this port.
    }
  }

  return stopped;
}

function rmSafeWithRetry(target, attempts = 6) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      if (fs.existsSync(target)) {
        fs.rmSync(target, {
          recursive: true,
          force: true,
          maxRetries: 5,
          retryDelay: 200,
        });
      }

      if (!fs.existsSync(target)) {
        return true;
      }
    } catch (error) {
      if (attempt === attempts - 1) {
        console.warn(`Could not fully remove ${target}: ${error.message}`);
        return false;
      }
    }

    sleepSync(400);
  }

  return false;
}

function isNextCacheCorrupted() {
  if (!fs.existsSync(nextDir)) {
    return false;
  }

  const packageJson = path.join(nextDir, "package.json");
  const serverAppDir = path.join(nextDir, "server", "app");
  const hasServerOutput =
    fs.existsSync(serverAppDir) && fs.readdirSync(serverAppDir).length > 0;

  if (!hasServerOutput) {
    return false;
  }

  if (!fs.existsSync(packageJson)) {
    return true;
  }

  if (!fs.existsSync(path.join(nextDir, "routes-manifest.json"))) {
    return true;
  }

  return false;
}

function shouldAutoClean({ forceClean, stoppedProcesses }) {
  if (forceClean) {
    return { clean: true, reason: "Force clean requested." };
  }

  if (stoppedProcesses > 0) {
    return {
      clean: true,
      reason: "Cleared cache after stopping a previous dev server (prevents corrupt builds).",
    };
  }

  if (isNextCacheCorrupted()) {
    return { clean: true, reason: "Detected a corrupted .next cache." };
  }

  return { clean: false, reason: "" };
}

function startNextDev() {
  console.log("Starting Next.js dev server (Turbopack)...");
  const nextBin = require.resolve("next/dist/bin/next");
  const child = spawn(process.execPath, [nextBin, "dev", "--turbo"], {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env,
    windowsHide: false,
  });

  child.on("error", (error) => {
    console.error("Failed to start Next.js dev server:", error.message);
    process.exit(1);
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

function prepareDevEnvironment(options = {}) {
  const forceClean = Boolean(options.forceClean);
  const noStart = Boolean(options.noStart);

  console.log("Checking dev environment...");
  const stopped = killPortListeners();

  if (stopped > 0) {
    sleepSync(1200);
  }

  const { clean, reason } = shouldAutoClean({ forceClean, stoppedProcesses: stopped });

  if (clean) {
    console.log(reason);
    console.log("Clearing .next cache...");
    rmSafeWithRetry(nextDir);
  } else {
    console.log("Cache looks healthy — reusing .next for a faster start.");
  }

  if (!noStart) {
    startNextDev();
  } else {
    console.log("Environment ready.");
  }
}

module.exports = {
  prepareDevEnvironment,
  killPortListeners,
  rmSafeWithRetry,
  isNextCacheCorrupted,
};

if (require.main === module) {
  const forceClean =
    process.argv.includes("--force-clean") || process.env.DEV_FORCE_CLEAN === "1";
  const noStart = process.argv.includes("--no-start");

  prepareDevEnvironment({ forceClean, noStart });
}
