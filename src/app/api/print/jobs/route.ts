import { PrintChannel, PrintJobStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/auth";
import { toNumber } from "@/lib/format";
import { writeAuditLog } from "@/lib/audit";
import { buildPrintPayload, printChannelMeta, suggestedTarget } from "@/lib/print";

const VALID_CHANNELS: PrintChannel[] = ["CASHIER_RECEIPT", "KITCHEN_TICKET"];

export async function GET(request: Request) {
  const configuredPrinterToken = process.env.PRINTER_AGENT_TOKEN;
  const printerToken = request.headers.get("x-printer-token");
  const isPrinterAgent = Boolean(configuredPrinterToken) && printerToken === configuredPrinterToken;

  if (!isPrinterAgent) {
    const auth = requireApiRole(request, ["MANAGER", "ADMIN"]);
    if (auth.response) return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const statusParam = (searchParams.get("status") as PrintJobStatus | "ALL" | null) || "PENDING";
  const channel = (searchParams.get("channel") as PrintChannel | null) || null;
  const printerTarget = searchParams.get("printerTarget");
  const limit = Math.min(100, Number(searchParams.get("limit") || "20"));

  const jobs = await prisma.printJob.findMany({
    where: {
      status: statusParam === "ALL" ? undefined : statusParam,
      channel: channel && VALID_CHANNELS.includes(channel) ? channel : undefined,
      printerTarget: printerTarget || undefined
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: {
      order: true
    }
  });

  return NextResponse.json(
    jobs.map((job) => ({
      id: job.id,
      orderId: job.orderId,
      status: job.status,
      channel: job.channel,
      payload: job.payload,
      printerTarget: job.printerTarget,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      order: {
        orderNumber: job.order.orderNumber,
        total: toNumber(job.order.total)
      }
    }))
  );
}

export async function POST(request: Request) {
  const auth = requireApiRole(request, ["CASHIER", "MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;

  try {
    const body = (await request.json()) as {
      orderId?: string;
      channel?: PrintChannel;
      printerTarget?: string;
    };

    if (!body.orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: body.orderId },
      include: {
        items: true
      }
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const [store, template] = await Promise.all([
      prisma.storeSetting.findUnique({ where: { id: 1 } }),
      prisma.receiptTemplate.findFirst({ where: { isDefault: true } })
    ]);

    const channel = body.channel && VALID_CHANNELS.includes(body.channel) ? body.channel : "CASHIER_RECEIPT";
    const payload = buildPrintPayload({
      channel,
      businessName: store?.businessName ?? "POS Shop",
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        createdAt: order.createdAt,
        subtotal: toNumber(order.subtotal),
        discount: toNumber(order.discount),
        tax: toNumber(order.tax),
        total: toNumber(order.total),
        items: order.items.map((item) => ({
          nameSnapshot: item.nameSnapshot,
          qty: item.qty,
          lineTotal: toNumber(item.lineTotal),
          note: item.note
        }))
      },
      footerText: template?.footerText ?? "ขอบคุณที่อุดหนุน"
    });

    const job = await prisma.printJob.create({
      data: {
        orderId: order.id,
        status: "PENDING",
        channel,
        payload,
        printerTarget: body.printerTarget?.trim() || suggestedTarget(channel)
      }
    });

    await writeAuditLog({
      action: "PRINT_JOB_ENQUEUED",
      entity: "PrintJob",
      entityId: job.id,
      actor: {
        userId: auth.session?.userId,
        username: auth.session?.username,
        role: auth.session?.role
      },
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        channel,
        printerTarget: job.printerTarget,
        channelLabel: printChannelMeta[channel].label
      }
    });

    return NextResponse.json(job);
  } catch {
    return NextResponse.json({ error: "Cannot enqueue print job" }, { status: 400 });
  }
}
