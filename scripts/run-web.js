const path = require("node:path");
const fs = require("node:fs");
const net = require("node:net");
const { spawn } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
try {
  process.loadEnvFile(path.join(repoRoot, ".env"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const [command, ...options] = process.argv.slice(2);
if (!command || !["dev", "build", "start"].includes(command)) {
  console.error("Usage: run-web.js <dev|build|start> [options]");
  process.exit(2);
}

function isPortListening(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    socket.setTimeout(1000);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => {
      resolve(false);
    });
  });
}

async function main() {
  let apiProcess = null;

  if (command === "dev") {
    const apiListening = await isPortListening(4000);
    if (!apiListening) {
      console.log("Backend API not detected on port 4000. Starting backend API...");
      const tsxBin = path.join(
        repoRoot,
        "node_modules",
        ".bin",
        process.platform === "win32" ? "tsx.cmd" : "tsx",
      );
      apiProcess = spawn(tsxBin, ["watch", "apps/api/src/server.ts"], {
        cwd: repoRoot,
        env: process.env,
        stdio: "inherit",
      });
      apiProcess.on("error", (err) => {
        console.warn("Could not start API process:", err.message);
      });
    } else {
      console.log("Backend API is running on port 4000.");
    }
  }

  const nextBin = require.resolve("next/dist/bin/next", { paths: [repoRoot] });
  const next = spawn(process.execPath, [nextBin, command, "apps/web", ...options], {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
  });

  function cleanup() {
    if (apiProcess && !apiProcess.killed) {
      try {
        apiProcess.kill();
      } catch {}
    }
  }

  process.on("SIGINT", () => {
    cleanup();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    cleanup();
    process.exit(0);
  });

  next.on("error", (error) => {
    cleanup();
    console.error("Could not start the frontend:", error);
    process.exitCode = 1;
  });

  next.on("exit", (code, signal) => {
    cleanup();
    process.exitCode = code ?? (signal ? 1 : 0);
    if (command === "build" && process.exitCode === 0) {
      try {
        const src = path.join(repoRoot, "apps", "web", ".next");
        const dst = path.join(repoRoot, ".next");
        if (fs.existsSync(src) && !fs.existsSync(dst)) {
          fs.symlinkSync(src, dst, "junction");
        }
      } catch {}
    }
  });
}

void main();
