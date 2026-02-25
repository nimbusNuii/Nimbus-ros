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

type WindowsPrinterRaw = {
  Name?: string;
  Default?: boolean;
  PrinterStatus?: string | number;
  PrinterState?: string | number;
  WorkOffline?: boolean;
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

function parseWindowsState(raw: WindowsPrinterRaw): PrinterState {
  if (raw.WorkOffline) return "disabled";

  const text = [raw.PrinterStatus, raw.PrinterState].filter(Boolean).map(String).join(" ").toLowerCase();
  const statusNumber = Number(raw.PrinterStatus);

  if (Number.isFinite(statusNumber)) {
    if (statusNumber === 4) return "printing";
    if (statusNumber === 3 || statusNumber === 5) return "idle";
    if (statusNumber === 6 || statusNumber === 7) return "disabled";
  }

  if (
    text.includes("offline") ||
    text.includes("error") ||
    text.includes("paused") ||
    text.includes("stopped")
  ) {
    return "disabled";
  }
  if (text.includes("printing") || text.includes("processing") || text.includes("busy")) {
    return "printing";
  }
  if (text.includes("idle") || text.includes("normal") || text.includes("ready")) {
    return "idle";
  }

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

async function runPowerShell(command: string) {
  const executables = ["powershell.exe", "powershell", "pwsh"];
  let lastError: unknown = null;

  for (const executable of executables) {
    try {
      return await run(executable, ["-NoProfile", "-Command", command]);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("PowerShell is not available");
}

async function detectFromWindows() {
  const output = await runPowerShell(
    "Get-Printer | Select-Object Name,Default,PrinterStatus,PrinterState,WorkOffline | ConvertTo-Json -Depth 3 -Compress"
  );
  if (!output.trim()) return [] as SystemPrinter[];

  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    return [] as SystemPrinter[];
  }

  const rows = Array.isArray(parsed) ? parsed : [parsed];
  const printers: SystemPrinter[] = [];

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const raw = row as WindowsPrinterRaw;
    const name = raw.Name?.trim();
    if (!name) continue;

    const rawStatus = [raw.PrinterStatus, raw.PrinterState, raw.WorkOffline ? "WorkOffline" : null]
      .filter(Boolean)
      .map(String)
      .join(" ");

    printers.push({
      target: name,
      label: name,
      isDefault: Boolean(raw.Default),
      state: parseWindowsState(raw),
      rawStatus: rawStatus || "unknown"
    });
  }

  return printers;
}

export async function detectSystemPrinters() {
  if (process.platform === "win32") {
    try {
      return await detectFromWindows();
    } catch {
      return [] as SystemPrinter[];
    }
  }

  const printers = await detectFromLpstat();
  return printers;
}
