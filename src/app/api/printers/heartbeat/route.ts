import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type HeartbeatPrinter = {
  target?: string;
  label?: string;
  channels?: ("CASHIER_RECEIPT" | "KITCHEN_TICKET")[];
  isDefault?: boolean;
  state?: string;
  rawStatus?: string;
};

function normalizeAgentId(raw: string | undefined) {
  const id = (raw || "").trim().slice(0, 120);
  return id || "default-agent";
}

function normalizePrinter(printer: HeartbeatPrinter) {
  const target = (printer.target || "").trim().slice(0, 180);
  if (!target) return null;

  const label = (printer.label || target).trim().slice(0, 180) || target;
  const channels = Array.isArray(printer.channels) ? printer.channels : [];

  return {
    target,
    label,
    supportsCashier: channels.length === 0 || channels.includes("CASHIER_RECEIPT"),
    supportsKitchen: channels.length === 0 || channels.includes("KITCHEN_TICKET"),
    isDefault: Boolean(printer.isDefault),
    state: printer.state?.trim().slice(0, 40) || null,
    rawStatus: printer.rawStatus?.trim().slice(0, 200) || null
  };
}

export async function POST(request: Request) {
  const configuredToken = process.env.PRINTER_AGENT_TOKEN || "";
  const providedToken = request.headers.get("x-printer-token") || "";

  if (!configuredToken || configuredToken !== providedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        agentId?: string;
        printers?: HeartbeatPrinter[];
      }
    | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const agentId = normalizeAgentId(body.agentId);
  const normalized = (Array.isArray(body.printers) ? body.printers : [])
    .map(normalizePrinter)
    .filter((item): item is NonNullable<ReturnType<typeof normalizePrinter>> => Boolean(item));
  const uniqueByTarget = new Map<string, (typeof normalized)[number]>();
  for (const item of normalized) {
    uniqueByTarget.set(item.target, item);
  }

  const printers = Array.from(uniqueByTarget.values());
  const now = new Date();
  const targets = printers.map((item) => item.target);

  await prisma.$transaction(async (tx) => {
    for (const item of printers) {
      await tx.printerPresence.upsert({
        where: {
          agentId_target: {
            agentId,
            target: item.target
          }
        },
        update: {
          label: item.label,
          supportsCashier: item.supportsCashier,
          supportsKitchen: item.supportsKitchen,
          isDefault: item.isDefault,
          state: item.state,
          rawStatus: item.rawStatus,
          lastSeenAt: now
        },
        create: {
          agentId,
          target: item.target,
          label: item.label,
          supportsCashier: item.supportsCashier,
          supportsKitchen: item.supportsKitchen,
          isDefault: item.isDefault,
          state: item.state,
          rawStatus: item.rawStatus,
          lastSeenAt: now
        }
      });
    }

    if (targets.length > 0) {
      await tx.printerPresence.deleteMany({
        where: {
          agentId,
          target: {
            notIn: targets
          }
        }
      });
    }
  });

  return NextResponse.json({
    ok: true,
    agentId,
    count: printers.length,
    seenAt: now.toISOString()
  });
}
