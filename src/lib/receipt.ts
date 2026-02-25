import { formatCurrency, formatDateTime } from "@/lib/format";

export type ReceiptContext = {
  businessName: string;
  branchName?: string | null;
  orderNumber: string;
  createdAt: Date | string;
  total: number;
  subtotal: number;
  discount: number;
  tax: number;
};

export function applyReceiptTemplate(text: string, context: ReceiptContext) {
  return text
    .replaceAll("{{businessName}}", context.businessName)
    .replaceAll("{{branchName}}", context.branchName ?? "")
    .replaceAll("{{orderNumber}}", context.orderNumber)
    .replaceAll("{{date}}", formatDateTime(context.createdAt))
    .replaceAll("{{subtotal}}", formatCurrency(context.subtotal))
    .replaceAll("{{discount}}", formatCurrency(context.discount))
    .replaceAll("{{tax}}", formatCurrency(context.tax))
    .replaceAll("{{total}}", formatCurrency(context.total));
}

function line(label: string, value: string) {
  const left = label.padEnd(16, " ");
  return `${left}${value}`;
}

export function buildEscPosText(params: {
  businessName: string;
  orderNumber: string;
  createdAt: Date | string;
  items: Array<{ name: string; qty: number; total: number }>;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  footerText: string;
}) {
  const rows = [
    "\x1B\x40",
    params.businessName,
    `Order: ${params.orderNumber}`,
    formatDateTime(params.createdAt),
    "------------------------------"
  ];

  for (const item of params.items) {
    rows.push(`${item.name} x${item.qty}`);
    rows.push(line("", formatCurrency(item.total)));
  }

  rows.push("------------------------------");
  rows.push(line("Subtotal", formatCurrency(params.subtotal)));
  rows.push(line("Discount", formatCurrency(params.discount)));
  rows.push(line("Tax", formatCurrency(params.tax)));
  rows.push(line("Total", formatCurrency(params.total)));
  rows.push("------------------------------");
  rows.push(params.footerText);
  rows.push("\n\n\n\x1D\x56\x41\x10");

  return rows.join("\n");
}
