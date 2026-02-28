import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "pipe",
    encoding: "utf8",
    ...options
  });

  if (result.status !== 0) {
    const out = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(out || `${command} ${args.join(" ")} failed`);
  }

  return (result.stdout || "").trim();
}

function parseEnvText(text) {
  const map = new Map();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    map.set(key, value);
  }
  return map;
}

function validateDatabaseUrl(name, value) {
  if (!value) {
    throw new Error(`${name} is missing in Vercel production environment`);
  }

  const lower = value.toLowerCase();
  if (lower.includes("localhost") || lower.includes("127.0.0.1") || lower.includes("host.docker.internal")) {
    throw new Error(`${name} points to local DB. Stop deploy.`);
  }

  if (!lower.includes(".neon.tech")) {
    throw new Error(`${name} is not a Neon URL (.neon.tech). Stop deploy.`);
  }
}

function createDeployTag() {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  const version = packageJson.version || "0.0.0";
  const ts = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
  const base = `v${version}`;
  let tag = base;

  const existing = run("git", ["tag", "--list", base]);
  if (existing.trim() === base) {
    tag = `${base}-deploy-${ts}`;
  }

  run("git", ["tag", "-a", tag, "-m", `deploy ${tag}`], { stdio: "pipe" });
  return tag;
}

async function main() {
  const tempDir = mkdtempSync(join(tmpdir(), "vercel-env-"));
  const envFile = join(tempDir, "production.env");

  try {
    console.log("[deploy] Pulling Vercel production env...");
    run("npx", ["vercel", "env", "pull", envFile, "--environment=production", "--yes"], {
      env: { ...process.env, CI: "1" }
    });

    const envValues = parseEnvText(readFileSync(envFile, "utf8"));
    const databaseUrl = envValues.get("DATABASE_URL") || "";
    const directUrl = envValues.get("DIRECT_URL") || "";

    validateDatabaseUrl("DATABASE_URL", databaseUrl);
    validateDatabaseUrl("DIRECT_URL", directUrl);

    if (directUrl.toLowerCase().includes("-pooler.")) {
      throw new Error("DIRECT_URL should be Neon direct URL (non-pooler) for transaction stability");
    }

    console.log("[deploy] DB URL check passed");
    console.log("[deploy] Deploying to Vercel production...");
    const deployOutput = run("npx", ["vercel", "--prod", "--yes"], {
      env: { ...process.env, CI: "1" }
    });
    console.log(deployOutput);

    const tag = createDeployTag();
    console.log(`[deploy] Created git tag: ${tag}`);
    console.log(`[deploy] Push tag with: git push origin ${tag}`);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`[deploy] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

