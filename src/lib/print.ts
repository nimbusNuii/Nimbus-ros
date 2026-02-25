import type { PrintChannel } from "@prisma/client";
import { buildEscPosText } from "@/lib/receipt";
import { formatDateTime, formatCurrency } from "@/lib/format";

type OrderForPrint = {
  id: string;
  orderNumber: string;
  createdAt: Date;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  items: Array<{
    nameSnapshot: string;
    qty: number;
    lineTotal: number;
    note: string | null;
  }>;
};

export function buildPrintPayload(args: {
  channel: PrintChannel;
  businessName: string;
  order: OrderForPrint;
  footerText?: string;
}) {
  if (args.channel === "KITCHEN_TICKET") {
    return buildKitchenTicketText({
      businessName: args.businessName,
      orderNumber: args.order.orderNumber,
      createdAt: args.order.createdAt,
      items: args.order.items.map((item) => ({
        name: item.nameSnapshot,
        qty: item.qty,
        note: item.note
      }))
    });
  }

  return buildEscPosText({
    businessName: args.businessName,
    orderNumber: args.order.orderNumber,
    createdAt: args.order.createdAt,
    items: args.order.items.map((item) => ({
      name: item.nameSnapshot,
      qty: item.qty,
      total: item.lineTotal
    })),
    subtotal: args.order.subtotal,
    discount: args.order.discount,
    tax: args.order.tax,
    total: args.order.total,
    footerText: args.footerText ?? "ขอบคุณที่อุดหนุน"
  });
}

function buildKitchenTicketText(params: {
  businessName: string;
  orderNumber: string;
  createdAt: Date;
  items: Array<{ name: string; qty: number; note: string | null }>;
}) {
  const rows = ["\x1B\x40", `${params.businessName} - KITCHEN`, `Order: ${params.orderNumber}`, formatDateTime(params.createdAt), "=============================="];

  for (const item of params.items) {
    rows.push(`${item.name} x${item.qty}`);
    if (item.note) {
      rows.push(`  * ${item.note}`);
    }
  }

  rows.push("==============================");
  rows.push(`Items: ${params.items.length}`);
  rows.push(`Printed: ${formatDateTime(new Date())}`);
  rows.push("\n\n\n\x1D\x56\x41\x10");

  return rows.join("\n");
}

export const printChannelMeta: Record<PrintChannel, { label: string; defaultTarget: string }> = {
  CASHIER_RECEIPT: { label: "ใบเสร็จแคชเชียร์", defaultTarget: "cashier" },
  KITCHEN_TICKET: { label: "บิลครัว", defaultTarget: "kitchen" }
};

export function formatChannelLabel(channel: PrintChannel) {
  return printChannelMeta[channel].label;
}

export function suggestedTarget(channel: PrintChannel) {
  return printChannelMeta[channel].defaultTarget;
}

export function renderOrderAmount(channel: PrintChannel, amount: number, currency: string) {
  if (channel === "KITCHEN_TICKET") {
    return "-";
  }
  return formatCurrency(amount, currency);
}
