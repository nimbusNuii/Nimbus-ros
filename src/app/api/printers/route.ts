import { PrintChannel } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/auth";
import { detectSystemPrinters } from "@/lib/system-printers";

type PrinterInfo = {
  target: string;
  label: string;
  channels: PrintChannel[];
  isDefault: boolean;
  source: "agent" | "system" | "history";
  state?: "idle" | "printing" | "disabled" | "unknown";
  rawStatus?: string;
};

function inferChannels(target: string): PrintChannel[] {
  const lower = target.toLowerCase();
  if (lower.includes("kitchen") || lower.includes("ครัว")) return ["KITCHEN_TICKET"];
  if (lower.includes("cashier") || lower.includes("counter") || lower.includes("แคช")) {
    return ["CASHIER_RECEIPT"];
  }
  return ["CASHIER_RECEIPT", "KITCHEN_TICKET"];
}

export async function GET(request: Request) {
  const auth = requireApiRole(request, ["CASHIER", "MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const channelFilter = searchParams.get("channel") as PrintChannel | null;
  const maxAgeSec = Math.min(600, Math.max(10, Number(searchParams.get("maxAgeSec") || "120")));
  const aliveAfter = new Date(Date.now() - maxAgeSec * 1000);
  const systemPrinters = await detectSystemPrinters();
  const agentPrinters = await prisma.printerPresence.findMany({
    where: {
      lastSeenAt: {
        gte: aliveAfter
      }
    },
    orderBy: [{ isDefault: "desc" }, { label: "asc" }],
    take: 500
  });

  const jobs = await prisma.printJob.findMany({
    where: {
      printerTarget: {
        not: null
      }
    },
    select: {
      printerTarget: true,
      channel: true
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 300
  });

  const map = new Map<
    string,
    {
      priority: number;
      item: PrinterInfo;
    }
  >();

  function mergePrinter(next: PrinterInfo, priority: number) {
    const existing = map.get(next.target);
    if (!existing) {
      map.set(next.target, {
        priority,
        item: next
      });
      return;
    }

    const mergedChannels = Array.from(new Set([...existing.item.channels, ...next.channels]));
    if (priority > existing.priority) {
      map.set(next.target, {
        priority,
        item: {
          ...next,
          channels: mergedChannels
        }
      });
      return;
    }

    map.set(next.target, {
      priority: existing.priority,
      item: {
        ...existing.item,
        channels: mergedChannels
      }
    });
  }

  for (const printer of agentPrinters) {
    const channels: PrintChannel[] = [];
    if (printer.supportsCashier) channels.push("CASHIER_RECEIPT");
    if (printer.supportsKitchen) channels.push("KITCHEN_TICKET");
    if (channels.length === 0) {
      channels.push("CASHIER_RECEIPT", "KITCHEN_TICKET");
    }

    mergePrinter(
      {
        target: printer.target,
        label: printer.label || printer.target,
        channels,
        isDefault: printer.isDefault,
        source: "agent",
        state: (printer.state as PrinterInfo["state"]) || "unknown",
        rawStatus: printer.rawStatus || `lastSeen ${printer.lastSeenAt.toISOString()}`
      },
      3
    );
  }

  for (const printer of systemPrinters) {
    mergePrinter(
      {
        target: printer.target,
        label: printer.label,
        channels: inferChannels(printer.target),
        isDefault: printer.isDefault,
        source: "system",
        state: printer.state,
        rawStatus: printer.rawStatus
      },
      2
    );
  }

  for (const job of jobs) {
    const target = job.printerTarget?.trim();
    if (!target) continue;

    const existing = map.get(target);
    if (existing) {
      mergePrinter(
        {
          ...existing.item,
          channels: [job.channel]
        },
        existing.priority
      );
      continue;
    }

    mergePrinter(
      {
        target,
        label: `เครื่อง ${target}`,
        channels: inferChannels(target),
        isDefault: false,
        source: "history"
      },
      1
    );
  }

  let printers = Array.from(map.values())
    .map((entry) => entry.item)
    .sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (a.source === "agent" && b.source !== "agent") return -1;
      if (a.source !== "agent" && b.source === "agent") return 1;
      if (a.source === "system" && b.source === "history") return -1;
      if (a.source === "history" && b.source === "system") return 1;
      if (!a.isDefault && b.isDefault) return 1;
      return a.label.localeCompare(b.label, "th");
    });

  if (channelFilter) {
    printers = printers.filter((item) => item.channels.includes(channelFilter));
  }

  return NextResponse.json(printers);
}
