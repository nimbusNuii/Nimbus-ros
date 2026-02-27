import { spawn } from "node:child_process";
import { existsSync, statSync, watch } from "node:fs";
import { extname, resolve } from "node:path";

const WATCH_TARGETS = [
  "src",
  "prisma",
  "scripts",
  "package.json",
  "tsconfig.json",
  "next.config.js",
  "next.config.mjs",
  ".env",
  ".env.local"
];

const WATCH_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".css",
  ".md",
  ".sql"
]);

const DEBOUNCE_MS = 220;
const FORCE_KILL_MS = 3000;

let child = null;
let restartTimer = null;
let isRestarting = false;
let queuedRestart = false;
let isShuttingDown = false;
const watchers = [];

function normalizePath(pathname) {
  return pathname.replace(/\\/g, "/");
}

function shouldRestart(pathname) {
  const normalized = normalizePath(pathname);
  if (
    normalized.includes("/.next/") ||
    normalized.includes("/node_modules/") ||
    normalized.includes("/.git/") ||
    normalized.endsWith(".log")
  ) {
    return false;
  }

  const ext = extname(normalized).toLowerCase();
  if (!ext) return true;
  return WATCH_EXTENSIONS.has(ext);
}

function startDevServer() {
  if (isShuttingDown) return;

  child = spawn("next", ["dev"], {
    shell: true,
    stdio: "inherit",
    env: process.env
  });

  child.on("exit", (code, signal) => {
    const exitedBy = signal || code || 0;
    const current = child;
    child = null;

    if (isShuttingDown) {
      process.exit(typeof exitedBy === "number" ? exitedBy : 0);
      return;
    }

    if (isRestarting && current) {
      return;
    }

    setTimeout(() => {
      if (!isShuttingDown && !child) {
        startDevServer();
      }
    }, 350);
  });
}

function restartDevServer(reasonPath) {
  if (isShuttingDown) return;

  if (restartTimer) {
    clearTimeout(restartTimer);
  }

  restartTimer = setTimeout(() => {
    if (isRestarting) {
      queuedRestart = true;
      return;
    }

    if (!child) {
      startDevServer();
      return;
    }

    isRestarting = true;
    console.log(`[dev-auto-restart] change detected: ${reasonPath}`);

    const processRef = child;
    const forceKillTimer = setTimeout(() => {
      if (processRef && !processRef.killed) {
        processRef.kill("SIGKILL");
      }
    }, FORCE_KILL_MS);

    processRef.once("exit", () => {
      clearTimeout(forceKillTimer);
      isRestarting = false;

      if (queuedRestart) {
        queuedRestart = false;
        restartDevServer(reasonPath);
        return;
      }

      startDevServer();
    });

    processRef.kill("SIGTERM");
  }, DEBOUNCE_MS);
}

function attachWatcher(targetPath) {
  const absPath = resolve(process.cwd(), targetPath);
  if (!existsSync(absPath)) return;

  let recursive = false;
  try {
    recursive = statSync(absPath).isDirectory();
  } catch {
    recursive = false;
  }

  try {
    const watcher = watch(absPath, { recursive }, (_eventType, filename) => {
      const changed = filename ? resolve(absPath, String(filename)) : absPath;
      if (!shouldRestart(changed)) return;
      restartDevServer(changed);
    });
    watchers.push(watcher);
  } catch (error) {
    console.warn(`[dev-auto-restart] cannot watch ${targetPath}:`, error instanceof Error ? error.message : String(error));
  }
}

function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  for (const watcher of watchers) {
    try {
      watcher.close();
    } catch {
      // ignore watcher close errors
    }
  }

  if (child) {
    child.kill("SIGTERM");
    setTimeout(() => {
      if (child && !child.killed) {
        child.kill("SIGKILL");
      }
      process.exit(0);
    }, FORCE_KILL_MS);
    return;
  }

  process.exit(0);
}

for (const target of WATCH_TARGETS) {
  attachWatcher(target);
}

console.log("[dev-auto-restart] watching source changes and auto-restarting next dev");
startDevServer();

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
