import { PrintChannel } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/auth";

type PrinterInfo = {
  target: string;
  label: string;
  channels: PrintChannel[];
  isDefault: boolean;
};

const BASE_PRINTERS: PrinterInfo[] = [
  {
    target: "cashier",
    label: "เครื่องแคชเชียร์",
    channels: ["CASHIER_RECEIPT"],
    isDefault: true
  },
  {
    target: "kitchen",
    label: "เครื่องครัว",
    channels: ["KITCHEN_TICKET"],
    isDefault: true
  }
];

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

  const map = new Map<string, PrinterInfo>();

  for (const base of BASE_PRINTERS) {
    map.set(base.target, { ...base, channels: [...base.channels] });
  }

  for (const job of jobs) {
    const target = job.printerTarget?.trim();
    if (!target) continue;

    const existing = map.get(target);
    if (existing) {
      if (!existing.channels.includes(job.channel)) {
        existing.channels.push(job.channel);
      }
      continue;
    }

    map.set(target, {
      target,
      label: `เครื่อง ${target}`,
      channels: inferChannels(target),
      isDefault: false
    });
  }

  let printers = Array.from(map.values()).sort((a, b) => {
    if (a.isDefault && !b.isDefault) return -1;
    if (!a.isDefault && b.isDefault) return 1;
    return a.label.localeCompare(b.label, "th");
  });

  if (channelFilter) {
    printers = printers.filter((item) => item.channels.includes(channelFilter));
  }

  return NextResponse.json(printers);
}
