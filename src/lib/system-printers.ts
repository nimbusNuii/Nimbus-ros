import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type PrinterState = "idle" | "printing" | "disabled" | "unknown";

export type SystemPrinter = {
  target: string;
  label: string;
  isDefault: boolean;
  state: PrinterState;
  rawStatus: string;
};

async function run(command: string, args: string[]) {
  const result = await execFileAsync(command, args, {
    timeout: 4000,
    maxBuffer: 1024 * 1024
  });
  return result.stdout;
}

function parseState(raw: string): PrinterState {
  const text = raw.toLowerCase();
  if (text.includes("disabled")) return "disabled";
  if (text.includes("printing")) return "printing";
  if (text.includes("idle")) return "idle";
  return "unknown";
}

async function detectFromLpstat() {
  let lpOut = "";
  let defaultOut = "";

  try {
    lpOut = await run("lpstat", ["-p"]);
  } catch {
    return [] as SystemPrinter[];
  }

  try {
    defaultOut = await run("lpstat", ["-d"]);
  } catch {
    defaultOut = "";
  }

  const defaultMatch = defaultOut.match(/system default destination:\s*(.+)/i);
  const defaultTarget = defaultMatch?.[1]?.trim() || "";

  const printers: SystemPrinter[] = [];
  for (const line of lpOut.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(/^printer\s+(\S+)\s+(.+)$/i);
    if (!match) continue;

    const target = match[1];
    const statusText = match[2];

    printers.push({
      target,
      label: target,
      isDefault: target === defaultTarget,
      state: parseState(statusText),
      rawStatus: statusText
    });
  }

  return printers;
}

export async function detectSystemPrinters() {
  if (process.platform === "win32") {
    return [] as SystemPrinter[];
  }

  const printers = await detectFromLpstat();
  return printers;
}
