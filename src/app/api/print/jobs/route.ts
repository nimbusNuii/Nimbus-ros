import { PrintChannel, PrintJobStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/auth";
import { toNumber } from "@/lib/format";
import { writeAuditLog } from "@/lib/audit";
import { buildPrintPayload, printChannelMeta, suggestedTarget } from "@/lib/print";
import { publishRealtime } from "@/lib/realtime";
import { parseLimit, parsePage } from "@/lib/query-utils";

const VALID_CHANNELS: PrintChannel[] = ["CASHIER_RECEIPT", "KITCHEN_TICKET"];
type PrintSort = "created_desc" | "created_asc";

type PrintJobRow = {
  id: string;
  orderId: string;
  status: PrintJobStatus;
  channel: PrintChannel;
  payload: string;
  printerTarget: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  order: {
    orderNumber: string;
    total: unknown;
  };
};

function mapJob(job: PrintJobRow) {
  return {
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
  };
}

export async function GET(request: Request) {
  const configuredPrinterToken = process.env.PRINTER_AGENT_TOKEN;
  const printerToken = request.headers.get("x-printer-token");
  const isPrinterAgent = Boolean(configuredPrinterToken) && printerToken === configuredPrinterToken;

  if (!isPrinterAgent) {
    const auth = requireApiRole(request, ["MANAGER", "ADMIN"]);
    if (auth.response) return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const statusParamRaw = searchParams.get("status");
  const statusParam: PrintJobStatus | "ALL" =
    statusParamRaw === "PRINTED" || statusParamRaw === "FAILED" || statusParamRaw === "ALL" ? statusParamRaw : "PENDING";
  const channelParam = searchParams.get("channel");
  const channel = channelParam && VALID_CHANNELS.includes(channelParam as PrintChannel) ? (channelParam as PrintChannel) : null;
  const printerTarget = searchParams.get("printerTarget");
  const q = (searchParams.get("q") || "").trim().slice(0, 120);
  const withMeta = searchParams.get("withMeta") === "1";
  const sortParam = searchParams.get("sort");
  const sort: PrintSort =
    sortParam === "created_asc" || sortParam === "created_desc"
      ? sortParam
      : isPrinterAgent
        ? "created_asc"
        : "created_desc";
  const limit = parseLimit(searchParams, 20, 100);
  const page = parsePage(searchParams);
  const skip = (page - 1) * limit;
  const where: Prisma.PrintJobWhereInput = {
    status: statusParam === "ALL" ? undefined : statusParam,
    channel: channel || undefined,
    printerTarget: printerTarget || undefined,
    ...(q
      ? {
          OR: [
            { printerTarget: { contains: q, mode: "insensitive" } },
            { errorMessage: { contains: q, mode: "insensitive" } },
            { order: { orderNumber: { contains: q, mode: "insensitive" } } }
          ]
        }
      : {})
  };

  const [jobs, total] = await Promise.all([
    prisma.printJob.findMany({
      where,
      orderBy: { createdAt: sort === "created_asc" ? "asc" : "desc" },
      skip,
      take: limit,
      include: {
        order: true
      }
    }),
    prisma.printJob.count({ where })
  ]);
  const rows = jobs.map((job) => mapJob(job));

  if (withMeta) {
    return NextResponse.json({
      rows,
      total,
      page,
      pageSize: limit
    });
  }
  return NextResponse.json(rows);
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

    publishRealtime("print.updated", {
      jobId: job.id,
      orderId: job.orderId,
      channel: job.channel,
      status: job.status,
      printerTarget: job.printerTarget
    });

    return NextResponse.json(job);
  } catch {
    return NextResponse.json({ error: "Cannot enqueue print job" }, { status: 400 });
  }
}
