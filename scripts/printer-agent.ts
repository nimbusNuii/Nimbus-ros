import { spawn } from "node:child_process";

const APP_URL = (process.env.POS_APP_URL || "http://localhost:3000").replace(/\/$/, "");
const PRINTER_AGENT_TOKEN = process.env.PRINTER_AGENT_TOKEN || "";
const PRINTER_TARGET = process.env.PRINTER_TARGET || "";
const PRINTER_CHANNEL = (process.env.PRINTER_CHANNEL || "CASHIER_RECEIPT") as
  | "CASHIER_RECEIPT"
  | "KITCHEN_TICKET";
const PRINT_COMMAND = process.env.PRINT_COMMAND || "";
const POLL_INTERVAL_MS = Number(process.env.PRINTER_POLL_MS || 2500);
const RETRY_ATTEMPTS = Math.max(1, Number(process.env.PRINTER_RETRY_ATTEMPTS || 3));
const RETRY_DELAY_MS = Math.max(0, Number(process.env.PRINTER_RETRY_DELAY_MS || 800));

if (!PRINTER_AGENT_TOKEN) {
  console.error("Missing PRINTER_AGENT_TOKEN");
  process.exit(1);
}

type PrintJob = {
  id: string;
  payload: string;
  channel: "CASHIER_RECEIPT" | "KITCHEN_TICKET";
  printerTarget: string | null;
};

async function fetchJson<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${APP_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-printer-token": PRINTER_AGENT_TOKEN,
      ...(init?.headers || {})
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HTTP ${response.status}: ${body}`);
  }

  return (await response.json()) as T;
}

function sendToPrinter(payload: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!PRINT_COMMAND) {
      process.stdout.write(`\n--- PRINT PAYLOAD START ---\n${payload}\n--- PRINT PAYLOAD END ---\n`);
      resolve();
      return;
    }

    const child = spawn(PRINT_COMMAND, [], {
      shell: true,
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr || `print command exited ${code}`));
      }
    });

    child.stdin.write(payload);
    child.stdin.end();
  });
}

async function markStatus(jobId: string, status: "PRINTED" | "FAILED", errorMessage?: string) {
  await fetchJson(`/api/print/jobs/${jobId}`, {
    method: "PATCH",
    body: JSON.stringify({ status, errorMessage })
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let isRunning = false;

async function tick() {
  if (isRunning) return;
  isRunning = true;

  try {
    const query = new URLSearchParams({
      status: "PENDING",
      limit: "10",
      channel: PRINTER_CHANNEL
    }).toString();
    const queryWithTarget = PRINTER_TARGET
      ? `${query}&printerTarget=${encodeURIComponent(PRINTER_TARGET)}`
      : query;

    const jobs = await fetchJson<PrintJob[]>(`/api/print/jobs?${queryWithTarget}`);

    for (const job of jobs) {
      let printed = false;
      let lastErrorMessage = "";

      for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
        try {
          await sendToPrinter(job.payload);
          await markStatus(job.id, "PRINTED");
          printed = true;
          console.log(
            `[printed] ${job.id} channel=${job.channel}${job.printerTarget ? ` target=${job.printerTarget}` : ""} attempt=${attempt}`
          );
          break;
        } catch (error) {
          lastErrorMessage = error instanceof Error ? error.message : "Unknown printer error";
          if (attempt < RETRY_ATTEMPTS) {
            await sleep(RETRY_DELAY_MS);
          }
        }
      }

      if (!printed) {
        await markStatus(job.id, "FAILED", lastErrorMessage);
        console.error(`[failed] ${job.id}: ${lastErrorMessage}`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown agent error";
    console.error(`[agent-error] ${message}`);
  } finally {
    isRunning = false;
  }
}

console.log(
  `Printer agent started. APP_URL=${APP_URL} channel=${PRINTER_CHANNEL} target=${PRINTER_TARGET || "*"} interval=${POLL_INTERVAL_MS}ms retryAttempts=${RETRY_ATTEMPTS}`
);
void tick();
setInterval(() => {
  void tick();
}, POLL_INTERVAL_MS);
